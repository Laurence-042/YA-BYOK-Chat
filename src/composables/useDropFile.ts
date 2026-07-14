import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

export function useDropFile(onDrop: (text: string, fileName: string) => void) {
  const { t } = useI18n()
  const isDragging = ref(false)
  let dragCounter = 0

  function handleDragEnter(e: DragEvent) {
    e.preventDefault()
    dragCounter++
    if (e.dataTransfer?.types.includes('Files')) {
      isDragging.value = true
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    dragCounter--
    if (dragCounter <= 0) {
      dragCounter = 0
      isDragging.value = false
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragCounter = 0
    isDragging.value = false

    const file = e.dataTransfer?.files?.[0]
    if (!file) return

    // Only accept text-like files
    const textTypes = ['text/', 'application/json', 'application/xml', 'application/javascript', 'application/x-yaml']
    const isTextType = textTypes.some(t => file.type.startsWith(t))
    const isTextExtension = /\.(txt|md|json|xml|yaml|yml|js|ts|py|log|csv|html|css|vue|sh|bat|ps1|toml|ini|cfg|env|sql|java|c|cpp|h|hpp|rs|go|rb|php|swift|kt|scala|r|m|mm|gradle|properties)$/i.test(file.name)

    if (!isTextType && !isTextExtension && file.type !== '') {
      // If type is empty but extension matches, still allow
      if (!isTextExtension) {
        ElMessage.warning(t('dropFileUnsupported'))
        return
      }
    }

    // Reject binary files by checking common binary extensions
    if (/\.(exe|dll|so|dylib|bin|dat|zip|tar|gz|rar|7z|png|jpg|jpeg|gif|bmp|ico|webp|mp3|mp4|avi|mov|mkv|pdf|doc|docx|xls|xlsx|ppt|pptx|ttf|otf|woff|woff2|eot|wasm|o|a|lib|class|pyc|pyo)$/i.test(file.name)) {
      ElMessage.warning(t('dropFileUnsupported'))
      return
    }

    // Size limit: 1 MB
    if (file.size > 1024 * 1024) {
      ElMessage.warning(t('dropFileTooLarge'))
      return
    }

    try {
      const text = await file.text()
      if (!text.trim()) {
        ElMessage.warning(t('dropFileEmpty'))
        return
      }
      onDrop(text, file.name)
    } catch {
      ElMessage.error(t('dropFileReadError'))
    }
  }

  onMounted(() => {
    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
  })

  onUnmounted(() => {
    document.removeEventListener('dragenter', handleDragEnter)
    document.removeEventListener('dragover', handleDragOver)
    document.removeEventListener('dragleave', handleDragLeave)
    document.removeEventListener('drop', handleDrop)
  })

  return { isDragging }
}
