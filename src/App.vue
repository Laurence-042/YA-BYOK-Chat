<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ModelBar from './components/ModelBar.vue'
import SummaryBar from './components/SummaryBar.vue'
import ChatPanel from './components/ChatPanel.vue'
import ChatComposer from './components/ChatComposer.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import DiagnosticsDialog from './components/DiagnosticsDialog.vue'
import { useConfig } from './composables/useConfig'
import { useModels } from './composables/useModels'
import { useChat } from './composables/useChat'

const { form, shareTooLong, copyShareUrl, loadConfigFromStorage, loadConfigFromUrl } = useConfig()
const { availableModels, modelsLoading, fetchModels } = useModels(form)
const {
  messages,
  summary,
  loading,
  summarizing,
  diagnostics,
  diagnosticsOpen,
  sendMessage,
  clearChat,
  copyDiagnostics,
  formatDiagnostics,
  loadMessagesFromStorage,
  loadSummaryFromStorage,
} = useChat(form)

const drawerOpen = ref(false)
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null)

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
      />

      <SummaryBar :summary="summary" />

      <ChatPanel
        ref="chatPanelRef"
        :messages="messages"
        :loading="loading"
        :summarizing="summarizing"
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
