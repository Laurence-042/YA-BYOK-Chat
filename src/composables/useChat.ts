import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  type ChatMessage,
  type Diagnostics,
  type ShareConfig,
  SUMMARIZE_AFTER_MIN,
  SUMMARIZE_AFTER_MAX,
  RETAIN_MESSAGES_MIN,
  RETAIN_MESSAGES_MAX,
  clampInt,
} from '../types'

const LS_MESSAGES_KEY = 'byok-messages'
const LS_SUMMARY_KEY = 'byok-summary'

export function useChat(form: ShareConfig) {
  const { t } = useI18n()

  const messages = ref<ChatMessage[]>([])
  const summary = ref('')
  const loading = ref(false)
  const summarizing = ref(false)
  const streamingContent = ref('')
  const diagnostics = ref<Diagnostics | null>(null)
  const diagnosticsOpen = ref(false)

  function saveMessages() {
    localStorage.setItem(LS_MESSAGES_KEY, JSON.stringify(messages.value))
  }

  function loadMessagesFromStorage() {
    try {
      const raw = localStorage.getItem(LS_MESSAGES_KEY)
      if (!raw) return
      const saved: unknown = JSON.parse(raw)
      if (Array.isArray(saved)) {
        messages.value = saved.filter(
          (m): m is ChatMessage =>
            m !== null &&
            typeof m === 'object' &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string',
        )
      }
    } catch {
      // ignore corrupt data
    }
  }

  function saveSummary() {
    if (summary.value) {
      localStorage.setItem(LS_SUMMARY_KEY, summary.value)
    } else {
      localStorage.removeItem(LS_SUMMARY_KEY)
    }
  }

  function loadSummaryFromStorage() {
    const raw = localStorage.getItem(LS_SUMMARY_KEY)
    if (typeof raw === 'string') summary.value = raw
  }

  watch(messages, saveMessages, { deep: true })
  watch(summary, saveSummary)

  function chatCompletionsUrl(): string {
    return form.endpoint.endsWith('/')
      ? `${form.endpoint}chat/completions`
      : `${form.endpoint}/chat/completions`
  }

  function parsedTemperature(): number | null {
    const raw = form.temperature.trim()
    if (!raw) return null
    const value = Number(raw)
    if (!Number.isFinite(value)) return null
    if (value < 0 || value > 2) return null
    return value
  }

  function parsedMaxTokens(): number | null {
    const raw = form.maxTokens.trim()
    if (!raw) return null
    const value = Number(raw)
    if (!Number.isFinite(value)) return null
    const intVal = Math.floor(value)
    if (intVal < 1) return null
    return intVal
  }

  function buildSystemPrompt(): string {
    const parts: string[] = []
    if (form.systemPrompt.trim()) parts.push(form.systemPrompt.trim())
    if (summary.value) parts.push(`${t('summaryPrefix')}\n${summary.value}`)
    return parts.join('\n\n')
  }

  /** Messages that are still sent to the API verbatim (not folded into summary). */
  function activeMessages(): ChatMessage[] {
    return messages.value.filter((m) => !m.summarized)
  }

  function buildRequestBody(extraMessages: ChatMessage[]): Record<string, unknown> {
    const systemContent = buildSystemPrompt()
    const requestMessages = [
      ...(systemContent ? [{ role: 'system' as const, content: systemContent }] : []),
      ...extraMessages.map((item) => ({ role: item.role, content: item.content })),
    ]
    const body: Record<string, unknown> = {
      model: form.model,
      messages: requestMessages,
    }
    const temp = parsedTemperature()
    if (temp !== null) body.temperature = temp
    const maxTok = parsedMaxTokens()
    if (maxTok !== null) body.max_tokens = maxTok
    return body
  }

  function redactBody(text: string): string {
    if (!text) return text
    // Defensive: never let an API key escape into diagnostics, even if echoed back.
    const trimmed = text.length > 600 ? text.slice(0, 600) + '…' : text
    if (!form.apiKey) return trimmed
    return trimmed.split(form.apiKey).join('***')
  }

  function recordDiagnostics(
    partial: Omit<Diagnostics, 'time' | 'userAgent' | 'endpoint' | 'model'>,
  ) {
    diagnostics.value = {
      time: new Date().toISOString(),
      endpoint: form.endpoint,
      model: form.model,
      userAgent: navigator.userAgent,
      ...partial,
    }
  }

  function formatDiagnostics(d: Diagnostics): string {
    const lines = [
      `time: ${d.time}`,
      `stage: ${d.stage}`,
      `endpoint: ${d.endpoint}`,
      `model: ${d.model}`,
      `app: YA-BYOK-Chat`,
      `userAgent: ${d.userAgent}`,
    ]
    if (typeof d.status === 'number')
      lines.push(`httpStatus: ${d.status} ${d.statusText ?? ''}`.trim())
    if (d.errorMessage) lines.push(`error: ${d.errorMessage}`)
    if (d.bodyExcerpt) lines.push(`responseBody:\n${d.bodyExcerpt}`)
    return lines.join('\n')
  }

  async function copyDiagnostics() {
    if (!diagnostics.value) return
    const text = formatDiagnostics(diagnostics.value)
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success(t('diagnosticsCopied'))
    } catch {
      ElMessage.error(t('copyFailed'))
    }
  }

  async function streamChatCompletions(
    extraMessages: ChatMessage[],
    stage: string,
    onChunk: (delta: string) => void,
  ): Promise<string> {
    const endpoint = chatCompletionsUrl()
    const body = { ...buildRequestBody(extraMessages), stream: true }
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + form.apiKey,
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      recordDiagnostics({
        stage,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
    if (!response.ok) {
      let bodyText = ''
      try {
        bodyText = await response.text()
      } catch {
        // ignore
      }
      recordDiagnostics({
        stage,
        status: response.status,
        statusText: response.statusText,
        bodyExcerpt: redactBody(bodyText),
      })
      throw new Error(`HTTP ${response.status}`)
    }
    const reader = response.body?.getReader()
    if (!reader) {
      recordDiagnostics({ stage, errorMessage: 'no response body' })
      throw new Error('no response body')
    }
    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue
          try {
            const json = JSON.parse(trimmed.slice(6)) as {
              choices?: Array<{ delta?: { content?: unknown } }>
            }
            const delta = json?.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta) {
              fullContent += delta
              onChunk(delta)
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    if (!fullContent) {
      recordDiagnostics({ stage, errorMessage: 'empty streaming response' })
      throw new Error('empty response')
    }
    return fullContent
  }

  async function logToWorker(userMessage: string, assistantMessage: string): Promise<void> {
    const url = form.cfWorkerUrl.trim()
    if (!url) return
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = form.cfWorkerToken.trim()
      if (token) headers['Authorization'] = 'Bearer ' + token
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          userMessage,
          assistantMessage,
        }),
      })
    } catch {
      // Fire-and-forget; silently ignore failures.
    }
  }

  async function maybeSummarize() {
    if (!form.autoSummary) return
    if (summarizing.value) return
    // Only count messages not already folded into the summary.
    const active = messages.value.filter((m) => !m.summarized)
    const threshold = clampInt(form.summarizeAfter, SUMMARIZE_AFTER_MIN, SUMMARIZE_AFTER_MAX)
    if (active.length <= threshold) return
    const keep = clampInt(form.retainMessages, RETAIN_MESSAGES_MIN, RETAIN_MESSAGES_MAX)
    const foldCount = active.length - keep
    if (foldCount <= 0) return
    const toFold = active.slice(0, foldCount)
    const transcript = toFold
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
    const previous = summary.value
      ? `Previous summary:\n${summary.value}\n\nNew turns to fold in:\n`
      : ''
    const instruction =
      'Summarize the following chat history concisely (under 200 words). ' +
      'Preserve key facts, user preferences, decisions, names, and unresolved questions. ' +
      'Reply with the summary only, no preamble.'
    const summaryMessages: ChatMessage[] = [
      { role: 'user', content: `${instruction}\n\n${previous}${transcript}` },
    ]
    // Mark these messages as folded NOW so the UI greys them out and shows the
    // summary divider immediately. Flags are reverted if summarization fails.
    toFold.forEach((m) => (m.summarized = true))
    summarizing.value = true
    try {
      // Build a minimal request that does NOT include the running summary as system,
      // to avoid recursive self-reference.
      const endpoint = chatCompletionsUrl()
      const body: Record<string, unknown> = {
        model: form.model,
        messages: summaryMessages.map((m) => ({ role: m.role, content: m.content })),
      }
      const temp = parsedTemperature()
      if (temp !== null) body.temperature = temp
      const maxTok = parsedMaxTokens()
      if (maxTok !== null) body.max_tokens = maxTok
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + form.apiKey,
        },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        toFold.forEach((m) => (m.summarized = false))
        return
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>
      }
      const content = data?.choices?.[0]?.message?.content
      if (typeof content === 'string' && content.trim()) {
        summary.value = content.trim()
        // Messages were already marked summarized above; keep them greyed out
        // (not deleted) so the user can see exactly what was folded.
      } else {
        toFold.forEach((m) => (m.summarized = false))
      }
    } catch {
      // Summarization is best-effort; un-fold on failure.
      toFold.forEach((m) => (m.summarized = false))
    } finally {
      summarizing.value = false
    }
  }

  async function sendMessage(text: string) {
    if (loading.value) return
    const content = text.trim()
    if (!form.endpoint || !form.apiKey || !form.model || !content) {
      return
    }
    messages.value.push({ role: 'user', content })

    loading.value = true
    streamingContent.value = ''
    try {
      const assistantContent = await streamChatCompletions(
        activeMessages(),
        'chat',
        (delta) => {
          streamingContent.value += delta
        },
      )
      messages.value.push({ role: 'assistant', content: assistantContent })
      streamingContent.value = ''
      // Fire-and-forget logging and summarization.
      void logToWorker(content, assistantContent)
      void maybeSummarize()
    } catch {
      streamingContent.value = ''
      diagnosticsOpen.value = true
      ElMessage.error(t('requestFailed'))
    } finally {
      loading.value = false
    }
  }

  function clearChat() {
    messages.value = []
    summary.value = ''
  }

  async function editAndResend(index: number, newContent: string) {
    if (loading.value) return
    const content = newContent.trim()
    if (!form.endpoint || !form.apiKey || !form.model || !content) return
    messages.value = [...messages.value.slice(0, index), { role: 'user', content }]
    loading.value = true
    streamingContent.value = ''
    try {
      const assistantContent = await streamChatCompletions(
        activeMessages(),
        'chat',
        (delta) => {
          streamingContent.value += delta
        },
      )
      messages.value.push({ role: 'assistant', content: assistantContent })
      streamingContent.value = ''
      void logToWorker(content, assistantContent)
      void maybeSummarize()
    } catch {
      streamingContent.value = ''
      diagnosticsOpen.value = true
      ElMessage.error(t('requestFailed'))
    } finally {
      loading.value = false
    }
  }

  return {
    messages,
    summary,
    loading,
    summarizing,
    streamingContent,
    diagnostics,
    diagnosticsOpen,
    sendMessage,
    editAndResend,
    clearChat,
    copyDiagnostics,
    formatDiagnostics,
    loadMessagesFromStorage,
    loadSummaryFromStorage,
  }
}
