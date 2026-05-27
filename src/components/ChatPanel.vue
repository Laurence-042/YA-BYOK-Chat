<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
}>()

const { t } = useI18n()
const chatPanelRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    const el = chatPanelRef.value
    if (el) el.scrollTop = el.scrollHeight
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
  () => [props.messages, props.loading, props.summarizing, props.streamingContent] as const,
  () => {
    scrollToBottom()
    void renderMermaidBlocks()
  },
  { deep: true },
)

defineExpose({ scrollToBottom })
</script>

<template>
  <div ref="chatPanelRef" class="chat-panel">
    <div v-if="messages.length === 0 && !loading && !streamingContent" class="empty">{{ t('emptyChat') }}</div>
    <div
      v-for="(item, index) in messages"
      :key="index"
      class="message"
      :class="item.role"
    >
      <div v-if="item.role === 'assistant'" class="bubble md-bubble" v-html="renderMd(item.content)" />
      <div v-else class="bubble">{{ item.content }}</div>
    </div>
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
