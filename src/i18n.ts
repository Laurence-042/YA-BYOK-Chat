import { createI18n } from 'vue-i18n'

const messages = {
  zh: {
    appTitle: 'YA-BYOK Chat',
    appSubtitle: '把配置放在链接里，发给家人即可使用',
    language: '语言',
    endpoint: '接口地址',
    apiKey: 'API Key',
    model: '模型',
    modelPlaceholder: '选择或输入模型名称',
    settings: '设置',
    systemPrompt: '系统提示词',
    optional: '可选',
    userMessage: '输入消息（Enter 发送，Shift+Enter 换行）',
    send: '发送',
    shareConfig: '复制分享链接',
    clearChat: '清空聊天',
    copied: '分享链接已复制',
    copyFailed: '复制失败，请手动复制',
    invalidConfig: '链接中的配置无效，已忽略',
    shareConfigIncomplete: '请先填写接口地址、API Key 和模型',
    shareTooLong: '分享链接过长，可能无法正常打开',
    configReady: '配置已从链接自动填入',
    assistant: '助手',
    you: '你',
    requestFailed: '请求失败',
    requestFailedHint: '请求未成功完成。可以点击下方按钮复制诊断信息，发送给开发者排查。',
    sending: '请求中...',
    emptyChat: '开始聊天吧。先输入问题，再点击发送。',
    temperature: '温度 (Temperature)',
    temperatureHint: '取值 0–2，留空则不发送该参数（多数服务默认 0.7~1.0）',
    advanced: '高级选项',
    autoSummary: '长对话自动摘要',
    autoSummaryHint: '消息较多时自动让模型把更早的对话压缩成一段摘要，节省上下文。',
    summaryLabel: '历史摘要',
    summaryPrefix: '以下是先前对话的摘要：',
    summarizing: '正在生成对话摘要...',
    typing: '助手正在输入...',
    copyDiagnostics: '复制诊断信息',
    diagnosticsTitle: '诊断信息',
    diagnosticsIntro: '若问题持续，请将以下信息发送给提供分享链接的人，便于排查。API Key 已自动隐去。',
    diagnosticsCopied: '诊断信息已复制',
    close: '关闭',
    retry: '重试',
  },
  en: {
    appTitle: 'YA-BYOK Chat',
    appSubtitle: 'Put config in a link and share it directly',
    language: 'Language',
    endpoint: 'Endpoint',
    apiKey: 'API Key',
    model: 'Model',
    modelPlaceholder: 'Select or type a model name',
    settings: 'Settings',
    systemPrompt: 'System Prompt',
    optional: 'Optional',
    userMessage: 'Type your message (Enter to send, Shift+Enter for newline)',
    send: 'Send',
    shareConfig: 'Copy Share Link',
    clearChat: 'Clear Chat',
    copied: 'Share link copied',
    copyFailed: 'Copy failed, please copy manually',
    invalidConfig: 'Invalid config in URL, ignored',
    shareConfigIncomplete: 'Please fill in Endpoint, API Key, and Model first',
    shareTooLong: 'Share URL is too long and may not open reliably',
    configReady: 'Config loaded from URL',
    assistant: 'Assistant',
    you: 'You',
    requestFailed: 'Request failed',
    requestFailedHint:
      'The request did not complete. Tap the button below to copy diagnostics and send them to the developer.',
    sending: 'Sending...',
    emptyChat: 'Start chatting. Enter a message and click Send.',
    temperature: 'Temperature',
    temperatureHint: '0–2. Leave blank to omit the field (most providers default to 0.7–1.0).',
    advanced: 'Advanced',
    autoSummary: 'Auto-summarize long conversations',
    autoSummaryHint:
      'When the history grows large, condense older messages into a short summary to save context.',
    summaryLabel: 'Conversation summary',
    summaryPrefix: 'Summary of earlier conversation:',
    summarizing: 'Summarizing conversation...',
    typing: 'Assistant is typing...',
    copyDiagnostics: 'Copy diagnostics',
    diagnosticsTitle: 'Diagnostics',
    diagnosticsIntro:
      'If the issue persists, send the information below to whoever shared this link. The API key has been redacted.',
    diagnosticsCopied: 'Diagnostics copied',
    close: 'Close',
    retry: 'Retry',
  },
}

type Locale = keyof typeof messages

function detectLocale(): Locale {
  const primary = navigator.languages?.[0]
  const fallback = navigator.language
  const source = (primary ?? fallback ?? 'en').toLowerCase()
  return source.startsWith('zh') ? 'zh' : 'en'
}

const detected = detectLocale()

export const i18n = createI18n({
  legacy: false,
  locale: detected as Locale,
  fallbackLocale: 'en',
  messages,
})
