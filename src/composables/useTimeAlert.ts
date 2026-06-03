import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'

/** Returns true if the current local time falls within [start, end] (HH:MM strings).
 *  When start > end the range wraps past midnight (e.g. 22:00–06:00). */
function isInTimeRange(start: string, end: string): boolean {
  if (!start || !end) return false
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return false

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em

  return startMinutes <= endMinutes
    ? nowMinutes >= startMinutes && nowMinutes <= endMinutes
    : nowMinutes >= startMinutes || nowMinutes <= endMinutes
}

export function useTimeAlert(alertStart: Ref<string>, alertEnd: Ref<string>) {
  // Increment every minute so `active` re-evaluates automatically.
  const tick = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  const active = computed(() => {
    void tick.value
    return isInTimeRange(alertStart.value, alertEnd.value)
  })

  onMounted(() => {
    timer = setInterval(() => {
      tick.value++
    }, 60_000)
  })

  onUnmounted(() => {
    if (timer !== null) clearInterval(timer)
  })

  return { active }
}
