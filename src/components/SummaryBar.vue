<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  summary: string
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="summary" class="summary-bar">
    <strong>{{ t('summaryLabel') }}：</strong>
    <span>{{ summary }}</span>
  </div>
</template>
