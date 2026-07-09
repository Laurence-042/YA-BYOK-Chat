export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  /**
   * True once this message has been folded into the running summary. Such
   * messages remain visible (greyed-out) so the user can see what the model
   * was told to summarise, but they are NOT sent to the API anymore.
   */
  summarized?: boolean
}

export type ShareConfig = {
  endpoint: string
  apiKey: string
  model: string
  systemPrompt: string
  temperature: string
  maxTokens: string
  summarizeAfter: number
  retainMessages: number
  autoSummary: boolean
  cfWorkerUrl: string
  cfWorkerToken: string
  alertStart: string
  alertEnd: string
  alertMessage: string
}

export type Diagnostics = {
  time: string
  stage: string
  endpoint: string
  model: string
  status?: number
  statusText?: string
  bodyExcerpt?: string
  errorMessage?: string
  userAgent: string
}

// Sensible bounds for the user-tunable advanced fields.
export const SUMMARIZE_AFTER_MIN = 5
export const SUMMARIZE_AFTER_MAX = 200
export const RETAIN_MESSAGES_MIN = 2
export const RETAIN_MESSAGES_MAX = 100

export function clampInt(value: number, min: number, max: number): number {
  const n = Math.floor(value)
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}
