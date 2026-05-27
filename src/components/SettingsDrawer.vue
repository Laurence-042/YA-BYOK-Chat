<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type ShareConfig,
  SUMMARIZE_AFTER_MIN,
  SUMMARIZE_AFTER_MAX,
  RETAIN_MESSAGES_MIN,
  RETAIN_MESSAGES_MAX,
} from '../types'

defineProps<{
  modelValue: boolean
  form: ShareConfig
  shareTooLong: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'copyShareUrl'): void
}>()

const { t, locale } = useI18n()
const advancedOpen = ref<string[]>([])
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="t('settings')"
    direction="ltr"
    size="380px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <el-form-item :label="t('language')">
        <el-select v-model="locale" size="large" style="width: 100%">
          <el-option value="zh" label="中文" />
          <el-option value="en" label="English" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('endpoint')" required>
        <el-input v-model="form.endpoint" placeholder="https://api.example.com/v1" size="large" />
      </el-form-item>
      <el-form-item :label="t('apiKey')" required>
        <el-input v-model="form.apiKey" type="password" show-password size="large" />
      </el-form-item>
      <el-form-item :label="`${t('systemPrompt')}（${t('optional')}）`">
        <el-input v-model="form.systemPrompt" type="textarea" :rows="4" />
      </el-form-item>

      <el-collapse v-model="advancedOpen" class="advanced-collapse">
        <el-collapse-item :title="t('advanced')" name="adv">
          <el-form-item :label="`${t('temperature')}（${t('optional')}）`">
            <el-input
              v-model="form.temperature"
              placeholder="0.7"
              inputmode="decimal"
              size="large"
            />
            <div class="form-hint">{{ t('temperatureHint') }}</div>
          </el-form-item>
          <el-form-item :label="`${t('maxTokens')}（${t('optional')}）`">
            <el-input
              v-model="form.maxTokens"
              placeholder="2048"
              inputmode="numeric"
              size="large"
            />
            <div class="form-hint">{{ t('maxTokensHint') }}</div>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>{{ t('autoSummary') }}</span>
            </template>
            <el-switch v-model="form.autoSummary" />
            <div class="form-hint">{{ t('autoSummaryHint') }}</div>
          </el-form-item>
          <el-form-item :label="t('summarizeAfter')">
            <el-input-number
              v-model="form.summarizeAfter"
              :min="SUMMARIZE_AFTER_MIN"
              :max="SUMMARIZE_AFTER_MAX"
              :disabled="!form.autoSummary"
              size="large"
            />
            <div class="form-hint">{{ t('summarizeAfterHint') }}</div>
          </el-form-item>
          <el-form-item :label="t('retainMessages')">
            <el-input-number
              v-model="form.retainMessages"
              :min="RETAIN_MESSAGES_MIN"
              :max="RETAIN_MESSAGES_MAX"
              :disabled="!form.autoSummary"
              size="large"
            />
            <div class="form-hint">{{ t('retainMessagesHint') }}</div>
          </el-form-item>
        </el-collapse-item>
      </el-collapse>
    </el-form>
    <div class="drawer-actions">
      <el-button type="primary" size="large" @click="$emit('copyShareUrl')">
        {{ t('shareConfig') }}
      </el-button>
    </div>
    <el-alert
      v-if="shareTooLong"
      :title="t('shareTooLong')"
      type="warning"
      show-icon
      :closable="false"
      style="margin-top: 12px"
    />
  </el-drawer>
</template>
