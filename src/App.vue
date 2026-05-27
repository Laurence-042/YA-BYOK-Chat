<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
}

const { t, locale } = useI18n()

const form = reactive<ShareConfig>({
  endpoint: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
})

const draftMessage = ref('')
const loading = ref(false)
const messages = ref<ChatMessage[]>([])
const drawerOpen = ref(false)
const availableModels = ref<string[]>([])
const modelsLoading = ref(false)

let fetchModelsTimer: ReturnType<typeof setTimeout> | null = null

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

watch(form, saveConfig, { deep: true })
watch(messages, saveMessages, { deep: true })

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
    (typeof candidate.systemPrompt === 'string' || typeof candidate.systemPrompt === 'undefined')
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
}

async function sendMessage() {
  if (!form.endpoint || !form.apiKey || !form.model || !draftMessage.value.trim()) {
    return
  }
  const content = draftMessage.value.trim()
  draftMessage.value = ''
  messages.value.push({ role: 'user', content })

  const endpoint = form.endpoint.endsWith('/')
    ? `${form.endpoint}chat/completions`
    : `${form.endpoint}/chat/completions`

  const requestMessages = [
    ...(form.systemPrompt
      ? [{ role: 'system' as const, content: form.systemPrompt.trim() }]
      : []),
    ...messages.value.map((item) => ({ role: item.role, content: item.content })),
  ]

  loading.value = true
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + form.apiKey,
      },
      body: JSON.stringify({
        model: form.model,
        messages: requestMessages,
      }),
    })
    if (!response.ok) {
      throw new Error('bad response')
    }
    const data = await response.json()
    const assistantContent = data?.choices?.[0]?.message?.content
    if (typeof assistantContent !== 'string' || !assistantContent) {
      throw new Error('invalid response')
    }
    messages.value.push({ role: 'assistant', content: assistantContent })
  } catch {
    ElMessage.error(t('requestFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadMessagesFromStorage()
  const fromUrl = loadConfigFromUrl()
  if (!fromUrl) {
    loadConfigFromStorage()
    if (form.endpoint && form.apiKey) {
      fetchModels()
    }
  }
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

      <div class="chat-panel">
        <div v-if="messages.length === 0" class="empty">{{ t('emptyChat') }}</div>
        <div v-for="(item, index) in messages" :key="index" class="message" :class="item.role">
          <strong>{{ item.role === 'user' ? t('you') : t('assistant') }}：</strong>
          <span>{{ item.content }}</span>
        </div>
      </div>

      <div class="composer">
        <el-input
          v-model="draftMessage"
          type="textarea"
          :rows="3"
          :placeholder="t('userMessage')"
          :disabled="loading"
          @keyup.ctrl.enter="sendMessage"
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
  </div>
</template>
