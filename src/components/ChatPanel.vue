<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { CopyDocument, Edit } from '@element-plus/icons-vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { ChatMessage } from '../types'

// ── Mermaid: lazy-loaded on first diagram encounter ────────────
type MermaidAPI = { initialize: (c: object) => void; render: (id: string, src: string) => Promise<{ svg: string }> }
let _mermaidPromise: Promise<MermaidAPI> | null = null
let mermaidIdCounter = 0
const mermaidCache = new Map<string, string>()

function getMermaid(): Promise<MermaidAPI> {
  if (!_mermaidPromise) {
    _mermaidPromise = import('mermaid').then((mod) => {
      const m = mod.default as unknown as MermaidAPI
      m.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })
      return m
    })
  }
  return _mermaidPromise
}

// ── marked setup ──────────────────────────────────────────────
marked.use({
  renderer: {
    link({ href, title, text }) {
      const titleAttr = title ? ` title="${title}"` : ''
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
    },
    code({ text, lang }) {
      if (lang === 'mermaid') {
        return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(text)}"></div>`
      }
      return false
    },
  },
})

/**
 * Replace any *unclosed* ```mermaid fence with an italic placeholder so marked
 * doesn't try to render partial diagram source during streaming.
 */
function replaceOpenMermaidBlock(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inMermaid = false
  const buf: string[] = []
  for (const line of lines) {
    if (!inMermaid && line.trimEnd() === '```mermaid') {
      inMermaid = true
      buf.length = 0
      buf.push(line)
    } else if (inMermaid && line.trimEnd() === '```') {
      buf.push(line)
      out.push(buf.join('\n'))
      inMermaid = false
    } else if (inMermaid) {
      buf.push(line)
    } else {
      out.push(line)
    }
  }
  if (inMermaid) out.push('\n*图表绘制中…*\n')
  return out.join('\n')
}

function renderMd(text: string): string {
  return DOMPurify.sanitize(marked.parse(replaceOpenMermaidBlock(text)) as string, {
    ADD_ATTR: ['target', 'rel', 'data-mermaid'],
  })
}

// ── Component ─────────────────────────────────────────────────
const props = defineProps<{
  messages: ChatMessage[]
  loading: boolean
  summarizing: boolean
  streamingContent: string
  summary: string
}>()

const emit = defineEmits<{
  (e: 'edit', index: number, newContent: string): void
}>()

const { t } = useI18n()
const chatPanelRef = ref<HTMLElement | null>(null)

/** Index in `messages` where active (non-summarized) conversation begins. */
const activeStartIndex = computed(() => {
  const arr = props.messages
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i].summarized) return i
  }
  return arr.length
})

/** Whether the summary divider card should render: when there is at least one
 * summarized message and either a summary exists or summarization is in progress. */
const showSummaryDivider = computed(
  () => activeStartIndex.value > 0 && (props.summary || props.summarizing),
)

// ── Edit state ─────────────────────────────────────────────────
const editingIndex = ref<number | null>(null)
const editContent = ref('')

function startEdit(index: number, content: string) {
  editingIndex.value = index
  editContent.value = content
}

function cancelEdit() {
  editingIndex.value = null
  editContent.value = ''
}

function confirmEdit(index: number) {
  const text = editContent.value.trim()
  if (!text) return
  emit('edit', index, text)
  editingIndex.value = null
  editContent.value = ''
}

// ── Copy ───────────────────────────────────────────────────────
async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success(t('messageCopied'))
  } catch {
    ElMessage.error(t('copyFailed'))
  }
}

/** Tolerance (px) for considering the user "at the bottom". */
const BOTTOM_THRESHOLD = 24
/** Whether the user is currently scrolled to (near) the bottom of the panel. */
const isAtBottom = ref(true)

function isScrolledToBottom(): boolean {
  const el = chatPanelRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD
}

function onScroll() {
  isAtBottom.value = isScrolledToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    const el = chatPanelRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
    isAtBottom.value = true
  })
}

async function renderMermaidBlocks() {
  await nextTick()
  const el = chatPanelRef.value
  if (!el) return
  const blocks = el.querySelectorAll<HTMLElement>('.mermaid-block:not([data-rendered])')
  if (blocks.length === 0) return
  const m = await getMermaid()
  for (const block of Array.from(blocks)) {
    const encoded = block.getAttribute('data-mermaid')
    if (!encoded) continue
    const source = decodeURIComponent(encoded)
    if (mermaidCache.has(source)) {
      block.innerHTML = mermaidCache.get(source)!
      block.setAttribute('data-rendered', '1')
      continue
    }
    const id = `mermaid-${++mermaidIdCounter}`
    try {
      const { svg } = await m.render(id, source)
      mermaidCache.set(source, svg)
      block.innerHTML = svg
      block.setAttribute('data-rendered', '1')
    } catch {
      const err = '<span class="mermaid-error">图表渲染失败</span>'
      mermaidCache.set(source, err)
      block.innerHTML = err
      block.setAttribute('data-rendered', '1')
    }
  }
}

watch(
  () => [props.messages, props.loading, props.summarizing, props.streamingContent, props.summary] as const,
  () => {
    // Only auto-follow new content when the user is already at the bottom.
    // If they have scrolled up, leave their view in place so they can read at
    // their own pace.
    if (isAtBottom.value) scrollToBottom()
    void renderMermaidBlocks()
  },
  { deep: true },
)

defineExpose({ scrollToBottom })
</script>

<template>
  <div ref="chatPanelRef" class="chat-panel" @scroll.passive="onScroll">
    <div v-if="messages.length === 0 && !loading && !streamingContent" class="empty">{{ t('emptyChat') }}</div>
    <template v-for="(item, index) in messages" :key="index">
      <!-- Inject the centered summary divider exactly at the boundary between
           folded (summarized) and active messages. -->
      <div v-if="showSummaryDivider && index === activeStartIndex" class="summary-divider">
        <div class="summary-bubble">
          <div class="summary-bubble-label">{{ t('summaryBubbleLabel') }}</div>
          <div v-if="summarizing && !summary" class="summary-bubble-loading">
            <span class="typing-dots"><i></i><i></i><i></i></span>
            <span>{{ t('summarizingBubble') }}</span>
          </div>
          <div v-else class="summary-bubble-content md-bubble" v-html="renderMd(summary)" />
          <div v-if="summarizing && summary" class="summary-bubble-updating">{{ t('summaryBubbleUpdating') }}</div>
        </div>
      </div>
      <div
        class="message"
        :class="[item.role, { summarized: item.summarized }]"
      >
      <div class="message-content">
        <template v-if="item.role === 'user' && editingIndex === index">
          <el-input
            v-model="editContent"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 12 }"
            class="edit-textarea"
            @keydown.esc="cancelEdit"
          />
          <div class="edit-actions">
            <el-button size="small" type="primary" @click="confirmEdit(index)">{{ t('editConfirm') }}</el-button>
            <el-button size="small" @click="cancelEdit">{{ t('editCancel') }}</el-button>
          </div>
        </template>
        <template v-else>
          <div v-if="item.role === 'assistant'" class="bubble md-bubble" v-html="renderMd(item.content)" />
          <div v-else class="bubble">{{ item.content }}</div>
          <div class="message-actions">
            <el-tooltip :content="t('copyMessage')" placement="top" :show-after="300">
              <el-button
                size="small"
                :icon="CopyDocument"
                circle
                :disabled="props.loading"
                @click="copyMessage(item.content)"
              />
            </el-tooltip>
            <el-tooltip v-if="item.role === 'user' && !item.summarized" :content="t('editMessage')" placement="top" :show-after="300">
              <el-button
                size="small"
                :icon="Edit"
                circle
                :disabled="props.loading"
                @click="startEdit(index, item.content)"
              />
            </el-tooltip>
          </div>
        </template>
      </div>
    </div>
    </template>
    <div v-if="loading && !streamingContent" class="message assistant">
      <div class="bubble typing-bubble">
        <span class="typing-dots"><i></i><i></i><i></i></span>
      </div>
    </div>
    <div v-if="streamingContent" class="message assistant">
      <div class="bubble md-bubble" v-html="renderMd(streamingContent)" />
    </div>
    <div v-if="summarizing" class="summarizing-hint">{{ t('summarizing') }}</div>
  </div>
</template>
