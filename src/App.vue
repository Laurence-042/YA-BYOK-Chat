<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ShareConfig = {
  endpoint: string
  apiKey: string
  model: string
  systemPrompt: string
  temperature: string
  autoSummary: boolean
}

type Diagnostics = {
  time: string
  stage: string
  endpoint: string
  model: string
  status?: number
  statusText?: string
  bodyExcerpt?: string
  errorMessage?: string
  userAgent: string
}

const { t, locale } = useI18n()

const form = reactive<ShareConfig>({
  endpoint: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
  temperature: '',
  autoSummary: true,
})

const draftMessage = ref('')
const loading = ref(false)
const summarizing = ref(false)
const messages = ref<ChatMessage[]>([])
const summary = ref('')
const drawerOpen = ref(false)
const availableModels = ref<string[]>([])
const modelsLoading = ref(false)
const diagnostics = ref<Diagnostics | null>(null)
const diagnosticsOpen = ref(false)
const chatPanelRef = ref<HTMLElement | null>(null)
const isComposing = ref(false)

let fetchModelsTimer: ReturnType<typeof setTimeout> | null = null

// Summary thresholds (kept internal to avoid power-user UI bloat).
const SUMMARY_TRIGGER_MESSAGES = 20
const SUMMARY_KEEP_LAST = 6

async function fetchModels() {
  if (!form.endpoint || !form.apiKey) {
    availableModels.value = []
    return
  }
  const base = form.endpoint.endsWith('/') ? form.endpoint : form.endpoint + '/'
  modelsLoading.value = true
  try {
    const response = await fetch(`${base}models`, {
      headers: { Authorization: 'Bearer ' + form.apiKey },
    })
    if (!response.ok) throw new Error('failed')
    const data = await response.json()
    const models: string[] = (data?.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => typeof id === 'string')
      .sort()
    availableModels.value = models
    if (!form.model && models.length > 0) {
      form.model = models[0]
    }
  } catch {
    availableModels.value = []
  } finally {
    modelsLoading.value = false
  }
}

watch([() => form.endpoint, () => form.apiKey], () => {
  if (fetchModelsTimer) clearTimeout(fetchModelsTimer)
  fetchModelsTimer = setTimeout(fetchModels, 600)
})

const LS_CONFIG_KEY = 'byok-config'
const LS_MESSAGES_KEY = 'byok-messages'
const LS_SUMMARY_KEY = 'byok-summary'

function saveConfig() {
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify({ ...form }))
}

function loadConfigFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY)
    if (!raw) return false
    const saved = JSON.parse(raw) as Partial<ShareConfig>
    if (typeof saved.endpoint === 'string') form.endpoint = saved.endpoint
    if (typeof saved.apiKey === 'string') form.apiKey = saved.apiKey
    if (typeof saved.model === 'string') form.model = saved.model
    if (typeof saved.systemPrompt === 'string') form.systemPrompt = saved.systemPrompt
    if (typeof saved.temperature === 'string') form.temperature = saved.temperature
    if (typeof saved.autoSummary === 'boolean') form.autoSummary = saved.autoSummary
    return true
  } catch {
    return false
  }
}

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

watch(form, saveConfig, { deep: true })
watch(messages, saveMessages, { deep: true })
watch(summary, saveSummary)
watch([messages, loading, summarizing], () => scrollChatToBottom(), { deep: true })

function scrollChatToBottom() {
  nextTick(() => {
    const el = chatPanelRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// Many environments still enforce ~2KB URL limits (legacy browsers, reverse proxies, email clients).
// Use 1800 as a safety margin for base URL/query overhead when sharing config links.
const MAX_SHARE_URL_LENGTH = 1800
const shareUrl = computed(() => {
  const payload = encodeConfig(form)
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('c', payload)
  return url.toString()
})

const shareTooLong = computed(() => shareUrl.value.length > MAX_SHARE_URL_LENGTH)

function encodeConfig(config: ShareConfig): string {
  const json = JSON.stringify(config)
  const encoded = new TextEncoder().encode(json)
  const binary = String.fromCharCode(...encoded)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeConfig(encoded: string): ShareConfig {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const decoded = new TextDecoder().decode(bytes)
  return JSON.parse(decoded)
}

function loadConfigFromUrl(): boolean {
  const url = new URL(window.location.href)
  const encoded = url.searchParams.get('c')
  if (!encoded) return false
  try {
    const decoded = decodeConfig(encoded)
    if (!isValidShareConfig(decoded)) {
      throw new Error('missing fields')
    }
    form.endpoint = decoded.endpoint
    form.apiKey = decoded.apiKey
    form.model = decoded.model
    form.systemPrompt = decoded.systemPrompt || ''
    if (typeof decoded.temperature === 'string') form.temperature = decoded.temperature
    if (typeof decoded.autoSummary === 'boolean') form.autoSummary = decoded.autoSummary
    ElMessage.success(t('configReady'))
    fetchModels()
    return true
  } catch {
    ElMessage.warning(t('invalidConfig'))
    return false
  }
}

function isValidShareConfig(config: unknown): config is ShareConfig {
  if (!config || typeof config !== 'object') {
    return false
  }
  const candidate = config as Partial<ShareConfig>
  return (
    typeof candidate.endpoint === 'string' &&
    /^https?:\/\//.test(candidate.endpoint) &&
    typeof candidate.apiKey === 'string' &&
    candidate.apiKey.trim().length > 0 &&
    typeof candidate.model === 'string' &&
    candidate.model.trim().length > 0 &&
    (typeof candidate.systemPrompt === 'string' || typeof candidate.systemPrompt === 'undefined') &&
    (typeof candidate.temperature === 'string' || typeof candidate.temperature === 'undefined') &&
    (typeof candidate.autoSummary === 'boolean' || typeof candidate.autoSummary === 'undefined')
  )
}

async function copyShareUrl() {
  if (!form.endpoint || !form.apiKey || !form.model) {
    ElMessage.warning(t('shareConfigIncomplete'))
    return
  }
  if (shareTooLong.value) {
    ElMessage.warning(t('shareTooLong'))
  }
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    ElMessage.success(t('copied'))
  } catch {
    ElMessage.error(t('copyFailed'))
  }
}

function clearChat() {
  messages.value = []
  summary.value = ''
}

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

function buildSystemPrompt(): string {
  const parts: string[] = []
  if (form.systemPrompt.trim()) parts.push(form.systemPrompt.trim())
  if (summary.value) parts.push(`${t('summaryPrefix')}\n${summary.value}`)
  return parts.join('\n\n')
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
  return body
}

function redactBody(text: string): string {
  if (!text) return text
  // Defensive: never let an API key escape into diagnostics, even if echoed back.
  const trimmed = text.length > 600 ? text.slice(0, 600) + '…' : text
  if (!form.apiKey) return trimmed
  return trimmed.split(form.apiKey).join('***')
}

function recordDiagnostics(partial: Omit<Diagnostics, 'time' | 'userAgent' | 'endpoint' | 'model'>) {
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
  if (typeof d.status === 'number') lines.push(`httpStatus: ${d.status} ${d.statusText ?? ''}`.trim())
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

async function callChatCompletions(extraMessages: ChatMessage[], stage: string): Promise<string> {
  const endpoint = chatCompletionsUrl()
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + form.apiKey,
      },
      body: JSON.stringify(buildRequestBody(extraMessages)),
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
  let data: unknown
  try {
    data = await response.json()
  } catch (err) {
    recordDiagnostics({
      stage,
      status: response.status,
      statusText: response.statusText,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
    ?.message?.content
  if (typeof content !== 'string' || !content) {
    recordDiagnostics({
      stage,
      status: response.status,
      statusText: response.statusText,
      bodyExcerpt: redactBody(JSON.stringify(data).slice(0, 600)),
      errorMessage: 'invalid response shape',
    })
    throw new Error('invalid response')
  }
  return content
}

async function maybeSummarize() {
  if (!form.autoSummary) return
  if (summarizing.value) return
  if (messages.value.length <= SUMMARY_TRIGGER_MESSAGES) return
  const keep = SUMMARY_KEEP_LAST
  const older = messages.value.slice(0, messages.value.length - keep)
  if (older.length === 0) return
  const transcript = older
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
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + form.apiKey,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) return
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data?.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim()) {
      summary.value = content.trim()
      // Drop the now-summarized older messages from history.
      messages.value = messages.value.slice(-keep)
    }
  } catch {
    // Summarization is best-effort; silently skip on failure.
  } finally {
    summarizing.value = false
  }
}

async function sendMessage() {
  if (loading.value) return
  if (!form.endpoint || !form.apiKey || !form.model || !draftMessage.value.trim()) {
    return
  }
  const content = draftMessage.value.trim()
  draftMessage.value = ''
  messages.value.push({ role: 'user', content })

  loading.value = true
  try {
    const assistantContent = await callChatCompletions(messages.value, 'chat')
    messages.value.push({ role: 'assistant', content: assistantContent })
    // Fire-and-forget summarization once chat grows large.
    void maybeSummarize()
  } catch {
    diagnosticsOpen.value = true
    ElMessage.error(t('requestFailed'))
  } finally {
    loading.value = false
  }
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  if (event.shiftKey) return
  if (isComposing.value || event.isComposing) return
  event.preventDefault()
  sendMessage()
}

onMounted(() => {
  loadMessagesFromStorage()
  loadSummaryFromStorage()
  const fromUrl = loadConfigFromUrl()
  if (!fromUrl) {
    loadConfigFromStorage()
    if (form.endpoint && form.apiKey) {
      fetchModels()
    }
  }
  scrollChatToBottom()
})
</script>

<template>
  <div class="page">
    <el-card class="main-card">
      <template #header>
        <div class="header">
          <div>
            <h1>{{ t('appTitle') }}</h1>
            <p>{{ t('appSubtitle') }}</p>
          </div>
          <div class="header-right">
            <el-select v-model="locale" class="lang-select" size="large">
              <el-option value="zh" label="中文" />
              <el-option value="en" label="English" />
            </el-select>
            <el-button size="large" @click="drawerOpen = true">{{ t('settings') }}</el-button>
          </div>
        </div>
      </template>

      <div class="model-bar">
        <el-select
          v-model="form.model"
          filterable
          allow-create
          default-first-option
          :loading="modelsLoading"
          :placeholder="t('modelPlaceholder')"
          size="large"
          class="model-select"
        >
          <el-option v-for="m in availableModels" :key="m" :label="m" :value="m" />
        </el-select>
        <el-button size="large" @click="clearChat">{{ t('clearChat') }}</el-button>
      </div>

      <div v-if="summary" class="summary-bar">
        <strong>{{ t('summaryLabel') }}：</strong>
        <span>{{ summary }}</span>
      </div>

      <div ref="chatPanelRef" class="chat-panel">
        <div v-if="messages.length === 0 && !loading" class="empty">{{ t('emptyChat') }}</div>
        <div
          v-for="(item, index) in messages"
          :key="index"
          class="message"
          :class="item.role"
        >
          <div class="message-role">
            {{ item.role === 'user' ? t('you') : t('assistant') }}
          </div>
          <div class="message-content">{{ item.content }}</div>
        </div>
        <div v-if="loading" class="message assistant typing">
          <div class="message-role">{{ t('assistant') }}</div>
          <div class="message-content">
            <span class="typing-dots"><i></i><i></i><i></i></span>
            <span class="typing-text">{{ t('typing') }}</span>
          </div>
        </div>
        <div v-if="summarizing" class="summarizing-hint">{{ t('summarizing') }}</div>
      </div>

      <div class="composer">
        <el-input
          v-model="draftMessage"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :placeholder="t('userMessage')"
          :disabled="loading"
          resize="none"
          @keydown="onComposerKeydown"
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
        />
        <el-button type="success" size="large" :loading="loading" @click="sendMessage">
          {{ loading ? t('sending') : t('send') }}
        </el-button>
      </div>
    </el-card>

    <el-drawer v-model="drawerOpen" :title="t('settings')" direction="rtl" size="380px">
      <el-form label-position="top">
        <el-form-item :label="t('endpoint')" required>
          <el-input v-model="form.endpoint" placeholder="https://api.example.com/v1" size="large" />
        </el-form-item>
        <el-form-item :label="t('apiKey')" required>
          <el-input v-model="form.apiKey" type="password" show-password size="large" />
        </el-form-item>
        <el-form-item :label="`${t('systemPrompt')}（${t('optional')}）`">
          <el-input v-model="form.systemPrompt" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item :label="`${t('temperature')}（${t('optional')}）`">
          <el-input
            v-model="form.temperature"
            placeholder="0.7"
            inputmode="decimal"
            size="large"
          />
          <div class="form-hint">{{ t('temperatureHint') }}</div>
        </el-form-item>
        <el-form-item :label="t('advanced')">
          <el-switch v-model="form.autoSummary" />
          <span class="switch-label">{{ t('autoSummary') }}</span>
          <div class="form-hint">{{ t('autoSummaryHint') }}</div>
        </el-form-item>
      </el-form>
      <div class="drawer-actions">
        <el-button type="primary" size="large" @click="copyShareUrl">
          {{ t('shareConfig') }}
        </el-button>
      </div>
      <el-alert
        v-if="shareTooLong"
        :title="t('shareTooLong')"
        type="warning"
        show-icon
        :closable="false"
        style="margin-top: 12px"
      />
    </el-drawer>

    <el-dialog
      v-model="diagnosticsOpen"
      :title="t('diagnosticsTitle')"
      width="min(560px, 92vw)"
      append-to-body
    >
      <p class="diagnostics-intro">{{ t('requestFailedHint') }}</p>
      <p class="diagnostics-intro">{{ t('diagnosticsIntro') }}</p>
      <pre v-if="diagnostics" class="diagnostics-block">{{ formatDiagnostics(diagnostics) }}</pre>
      <template #footer>
        <el-button @click="diagnosticsOpen = false">{{ t('close') }}</el-button>
        <el-button type="primary" :disabled="!diagnostics" @click="copyDiagnostics">
          {{ t('copyDiagnostics') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
