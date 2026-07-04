<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Camera } from '@element-plus/icons-vue'

defineProps<{
  modelValue: string
  availableModels: string[]
  modelsLoading: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'clearChat'): void
  (e: 'exportScreenshot'): void
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
    <el-tooltip :content="t('exportScreenshot')" placement="top" :show-after="300">
      <el-button size="large" :icon="Camera" @click="$emit('exportScreenshot')" />
    </el-tooltip>
    <el-button size="large" @click="$emit('clearChat')">{{ t('clearChat') }}</el-button>
  </div>
</template>
