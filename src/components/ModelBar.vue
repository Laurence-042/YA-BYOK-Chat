<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  modelValue: string
  availableModels: string[]
  modelsLoading: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'clearChat'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="model-bar">
    <el-select
      :model-value="modelValue"
      filterable
      allow-create
      default-first-option
      :loading="modelsLoading"
      :placeholder="t('modelPlaceholder')"
      size="large"
      class="model-select"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <el-option v-for="m in availableModels" :key="m" :label="m" :value="m" />
    </el-select>
    <el-button size="large" @click="$emit('clearChat')">{{ t('clearChat') }}</el-button>
  </div>
</template>
