<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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

const MAX_SHARE_URL_LENGTH = 1800
const shareUrl = computed(() => {
  const payload = encodeConfig(form)
  const url = new URL(window.location.href)
  url.searchParams.set('c', payload)
  return url.toString()
})

const shareTooLong = computed(() => shareUrl.value.length > MAX_SHARE_URL_LENGTH)

function encodeConfig(config: ShareConfig): string {
  const json = JSON.stringify(config)
  const encoded = new TextEncoder().encode(json)
  const binary = String.fromCodePoint(...encoded)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeConfig(encoded: string): ShareConfig {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0)
  const decoded = new TextDecoder().decode(bytes)
  return JSON.parse(decoded)
}

function loadConfigFromUrl() {
  const url = new URL(window.location.href)
  const encoded = url.searchParams.get('c')
  if (!encoded) {
    return
  }
  try {
    const decoded = decodeConfig(encoded)
    if (!decoded.endpoint || !decoded.apiKey || !decoded.model) {
      throw new Error('missing fields')
    }
    form.endpoint = decoded.endpoint
    form.apiKey = decoded.apiKey
    form.model = decoded.model
    form.systemPrompt = decoded.systemPrompt || ''
    ElMessage.success(t('configReady'))
  } catch {
    ElMessage.warning(t('invalidConfig'))
  }
}

async function copyShareUrl() {
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

onMounted(loadConfigFromUrl)
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
          <el-select v-model="locale" class="lang-select" size="large">
            <el-option value="zh" label="中文" />
            <el-option value="en" label="English" />
          </el-select>
        </div>
      </template>

      <el-form label-position="top" class="config-grid">
        <el-form-item :label="t('endpoint')" required>
          <el-input v-model="form.endpoint" placeholder="https://api.example.com/v1" size="large" />
        </el-form-item>
        <el-form-item :label="t('apiKey')" required>
          <el-input v-model="form.apiKey" type="password" show-password size="large" />
        </el-form-item>
        <el-form-item :label="t('model')" required>
          <el-input v-model="form.model" placeholder="claude-3-5-sonnet" size="large" />
        </el-form-item>
        <el-form-item :label="`${t('systemPrompt')}（${t('optional')}）`">
          <el-input v-model="form.systemPrompt" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <div class="actions">
        <el-button type="primary" size="large" @click="copyShareUrl">
          {{ t('shareConfig') }}
        </el-button>
        <el-button size="large" @click="clearChat">{{ t('clearChat') }}</el-button>
      </div>
      <el-alert v-if="shareTooLong" :title="t('shareTooLong')" type="warning" show-icon :closable="false" />

      <el-divider />

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
  </div>
</template>
