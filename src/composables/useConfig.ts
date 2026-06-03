import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  type ShareConfig,
  SUMMARIZE_AFTER_MIN,
  SUMMARIZE_AFTER_MAX,
  RETAIN_MESSAGES_MIN,
  RETAIN_MESSAGES_MAX,
  clampInt,
} from '../types'

const LS_CONFIG_KEY = 'byok-config'

// Many environments still enforce ~2KB URL limits (legacy browsers, reverse proxies, email clients).
// Use 1800 as a safety margin for base URL/query overhead when sharing config links.
export const MAX_SHARE_URL_LENGTH = 1800

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
    (typeof candidate.maxTokens === 'string' || typeof candidate.maxTokens === 'undefined') &&
    (typeof candidate.summarizeAfter === 'number' ||
      typeof candidate.summarizeAfter === 'undefined') &&
    (typeof candidate.retainMessages === 'number' ||
      typeof candidate.retainMessages === 'undefined') &&
    (typeof candidate.autoSummary === 'boolean' || typeof candidate.autoSummary === 'undefined') &&
    (typeof candidate.cfWorkerUrl === 'string' || typeof candidate.cfWorkerUrl === 'undefined') &&
    (typeof candidate.cfWorkerToken === 'string' || typeof candidate.cfWorkerToken === 'undefined')
  )
}

export function useConfig() {
  const { t } = useI18n()

  const form = reactive<ShareConfig>({
    endpoint: '',
    apiKey: '',
    model: '',
    systemPrompt: '',
    temperature: '',
    maxTokens: '',
    summarizeAfter: 20,
    retainMessages: 6,
    autoSummary: true,
    cfWorkerUrl: '',
    cfWorkerToken: '',
  })

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
      if (typeof saved.maxTokens === 'string') form.maxTokens = saved.maxTokens
      if (typeof saved.summarizeAfter === 'number' && Number.isFinite(saved.summarizeAfter)) {
        form.summarizeAfter = clampInt(saved.summarizeAfter, SUMMARIZE_AFTER_MIN, SUMMARIZE_AFTER_MAX)
      }
      if (typeof saved.retainMessages === 'number' && Number.isFinite(saved.retainMessages)) {
        form.retainMessages = clampInt(saved.retainMessages, RETAIN_MESSAGES_MIN, RETAIN_MESSAGES_MAX)
      }
      if (typeof saved.autoSummary === 'boolean') form.autoSummary = saved.autoSummary
      if (typeof saved.cfWorkerUrl === 'string') form.cfWorkerUrl = saved.cfWorkerUrl
      if (typeof saved.cfWorkerToken === 'string') form.cfWorkerToken = saved.cfWorkerToken
      return true
    } catch {
      return false
    }
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
      if (typeof decoded.maxTokens === 'string') form.maxTokens = decoded.maxTokens
      if (typeof decoded.summarizeAfter === 'number' && Number.isFinite(decoded.summarizeAfter)) {
        form.summarizeAfter = clampInt(
          decoded.summarizeAfter,
          SUMMARIZE_AFTER_MIN,
          SUMMARIZE_AFTER_MAX,
        )
      }
      if (typeof decoded.retainMessages === 'number' && Number.isFinite(decoded.retainMessages)) {
        form.retainMessages = clampInt(
          decoded.retainMessages,
          RETAIN_MESSAGES_MIN,
          RETAIN_MESSAGES_MAX,
        )
      }
      if (typeof decoded.autoSummary === 'boolean') form.autoSummary = decoded.autoSummary
      if (typeof decoded.cfWorkerUrl === 'string') form.cfWorkerUrl = decoded.cfWorkerUrl
      if (typeof decoded.cfWorkerToken === 'string') form.cfWorkerToken = decoded.cfWorkerToken
      ElMessage.success(t('configReady'))
      return true
    } catch {
      ElMessage.warning(t('invalidConfig'))
      return false
    }
  }

  const shareUrl = computed(() => {
    const payload = encodeConfig(form)
    const url = new URL(window.location.origin + window.location.pathname)
    url.searchParams.set('c', payload)
    return url.toString()
  })

  const shareTooLong = computed(() => shareUrl.value.length > MAX_SHARE_URL_LENGTH)

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

  watch(form, saveConfig, { deep: true })

  return {
    form,
    shareUrl,
    shareTooLong,
    copyShareUrl,
    loadConfigFromStorage,
    loadConfigFromUrl,
  }
}
