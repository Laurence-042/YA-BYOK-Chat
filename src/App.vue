<script setup lang="ts">
import { nextTick, onMounted, ref, toRef } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import AppHeader from './components/AppHeader.vue'
import ModelBar from './components/ModelBar.vue'
import ChatPanel from './components/ChatPanel.vue'
import ChatComposer from './components/ChatComposer.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import DiagnosticsDialog from './components/DiagnosticsDialog.vue'
import { useConfig } from './composables/useConfig'
import { useModels } from './composables/useModels'
import { useChat } from './composables/useChat'
import { useTimeAlert } from './composables/useTimeAlert'

const { t } = useI18n()
const { form, shareTooLong, copyShareUrl, loadConfigFromStorage, loadConfigFromUrl } = useConfig()
const { availableModels, modelsLoading, fetchModels } = useModels(form)
const {
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
} = useChat(form)

const drawerOpen = ref(false)
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null)
const alertDismissed = ref(false)

const { active: alertActive } = useTimeAlert(toRef(form, 'alertStart'), toRef(form, 'alertEnd'))

async function exportScreenshot() {
  const panelEl = chatPanelRef.value?.$el as HTMLElement | undefined
  if (!panelEl) return
  const origMaxHeight = panelEl.style.maxHeight
  const origOverflow = panelEl.style.overflow
  panelEl.style.maxHeight = 'none'
  panelEl.style.overflow = 'visible'
  await nextTick()
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(panelEl, { useCORS: true, logging: false })
    const link = document.createElement('a')
    link.download = `chat-export-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch {
    ElMessage.error(t('copyFailed'))
  } finally {
    panelEl.style.maxHeight = origMaxHeight
    panelEl.style.overflow = origOverflow
  }
}

onMounted(() => {
  loadMessagesFromStorage()
  loadSummaryFromStorage()
  const fromUrl = loadConfigFromUrl()
  if (fromUrl) {
    fetchModels()
  } else {
    loadConfigFromStorage()
    if (form.endpoint && form.apiKey) {
      fetchModels()
    }
  }
  chatPanelRef.value?.scrollToBottom()
})
</script>

<template>
  <div class="page">
    <el-card class="main-card">
      <template #header>
        <AppHeader @open-settings="drawerOpen = true" />
      </template>

      <ModelBar
        v-model="form.model"
        :available-models="availableModels"
        :models-loading="modelsLoading"
        @clear-chat="clearChat"
        @export-screenshot="exportScreenshot"
      />

      <el-alert
        v-if="alertActive && form.alertMessage && !alertDismissed"
        :title="form.alertMessage"
        type="warning"
        show-icon
        @close="alertDismissed = true"
        style="margin-bottom: 8px"
      />

      <ChatPanel
        ref="chatPanelRef"
        :messages="messages"
        :loading="loading"
        :summarizing="summarizing"
        :streaming-content="streamingContent"
        :summary="summary"
        @edit="editAndResend"
      />

      <ChatComposer :loading="loading" @send="sendMessage" />
    </el-card>

    <SettingsDrawer
      v-model="drawerOpen"
      :form="form"
      :share-too-long="shareTooLong"
      @copy-share-url="copyShareUrl"
    />

    <DiagnosticsDialog
      v-model="diagnosticsOpen"
      :diagnostics="diagnostics"
      :format-diagnostics="formatDiagnostics"
      @copy-diagnostics="copyDiagnostics"
    />
  </div>
</template>
