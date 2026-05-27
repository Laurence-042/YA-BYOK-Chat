import { ref, watch } from 'vue'
import type { ShareConfig } from '../types'

export function useModels(form: ShareConfig) {
  const availableModels = ref<string[]>([])
  const modelsLoading = ref(false)
  let fetchModelsTimer: ReturnType<typeof setTimeout> | null = null

  async function fetchModels() {
    if (!form.endpoint || !form.apiKey) {
      availableModels.value = []
      return
    }
    const base = form.endpoint.endsWith('/') ? form.endpoint : form.endpoint + '/'
    modelsLoading.value = true
    try {
      const response = await fetch(`${base}models`, {
        headers: { Authorization: 'Bearer ' + form.apiKey },
      })
      if (!response.ok) throw new Error('failed')
      const data = await response.json()
      const models: string[] = (data?.data ?? [])
        .map((m: { id: string }) => m.id)
        .filter((id: string) => typeof id === 'string')
        .sort()
      availableModels.value = models
      if (!form.model && models.length > 0) {
        form.model = models[0]
      }
    } catch {
      availableModels.value = []
    } finally {
      modelsLoading.value = false
    }
  }

  watch([() => form.endpoint, () => form.apiKey], () => {
    if (fetchModelsTimer) clearTimeout(fetchModelsTimer)
    fetchModelsTimer = setTimeout(fetchModels, 600)
  })

  return { availableModels, modelsLoading, fetchModels }
}
