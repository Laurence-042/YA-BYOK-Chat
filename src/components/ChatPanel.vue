<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatMessage } from '../types'

const props = defineProps<{
  messages: ChatMessage[]
  loading: boolean
  summarizing: boolean
}>()

const { t } = useI18n()
const chatPanelRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    const el = chatPanelRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(
  () => [props.messages, props.loading, props.summarizing] as const,
  () => scrollToBottom(),
  { deep: true },
)

defineExpose({ scrollToBottom })
</script>

<template>
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
</template>
