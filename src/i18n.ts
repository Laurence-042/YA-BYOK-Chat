import { createI18n } from 'vue-i18n'

const messages = {
  zh: {
    appTitle: 'YA-BYOK Chat',
    appSubtitle: '把配置放在链接里，发给家人即可使用',
    language: '语言',
    endpoint: '接口地址',
    apiKey: 'API Key',
    model: '模型',
    systemPrompt: '系统提示词',
    optional: '可选',
    userMessage: '输入消息',
    send: '发送',
    shareConfig: '复制分享链接',
    clearChat: '清空聊天',
    copied: '分享链接已复制',
    copyFailed: '复制失败，请手动复制',
    invalidConfig: '链接中的配置无效，已忽略',
    shareTooLong: '分享链接过长，可能无法正常打开',
    configReady: '配置已从链接自动填入',
    assistant: '助手',
    you: '你',
    requestFailed: '请求失败，请检查地址、Key 和模型',
    sending: '请求中...',
    emptyChat: '开始聊天吧。先输入问题，再点击发送。',
  },
  en: {
    appTitle: 'YA-BYOK Chat',
    appSubtitle: 'Put config in a link and share it directly',
    language: 'Language',
    endpoint: 'Endpoint',
    apiKey: 'API Key',
    model: 'Model',
    systemPrompt: 'System Prompt',
    optional: 'Optional',
    userMessage: 'Type your message',
    send: 'Send',
    shareConfig: 'Copy Share Link',
    clearChat: 'Clear Chat',
    copied: 'Share link copied',
    copyFailed: 'Copy failed, please copy manually',
    invalidConfig: 'Invalid config in URL, ignored',
    shareTooLong: 'Share URL is too long and may not open reliably',
    configReady: 'Config loaded from URL',
    assistant: 'Assistant',
    you: 'You',
    requestFailed: 'Request failed. Please verify endpoint, key, and model.',
    sending: 'Sending...',
    emptyChat: 'Start chatting. Enter a message and click Send.',
  },
}

type Locale = keyof typeof messages

const detected = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'

export const i18n = createI18n({
  legacy: false,
  locale: detected as Locale,
  fallbackLocale: 'en',
  messages,
})
