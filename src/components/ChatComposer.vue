<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'send', text: string): void
}>()

const { t } = useI18n()

const draftMessage = ref('')
const isComposing = ref(false)

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
