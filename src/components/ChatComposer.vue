<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { UploadFilled } from '@element-plus/icons-vue'
import { useDropFile } from '../composables/useDropFile'

const props = defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'send', text: string): void
}>()

const { t } = useI18n()

const draftMessage = ref('')
const isComposing = ref(false)

function onFileDrop(text: string, _fileName: string) {
  draftMessage.value = text
}

const { isDragging } = useDropFile(onFileDrop)

function send() {
  if (props.loading) return
  const text = draftMessage.value.trim()
  if (!text) return
  emit('send', text)
  draftMessage.value = ''
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  if (event.shiftKey) return
  if (isComposing.value || event.isComposing) return
  event.preventDefault()
  send()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isDragging" class="drop-overlay">
      <div class="drop-overlay-content">
        <el-icon :size="32" color="#94a3b8"><UploadFilled /></el-icon>
        <p>{{ t('dropFileHint') }}</p>
      </div>
    </div>
  </Teleport>
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
    <el-button type="success" size="large" :loading="loading" @click="send">
      {{ loading ? t('sending') : t('send') }}
    </el-button>
  </div>
</template>
