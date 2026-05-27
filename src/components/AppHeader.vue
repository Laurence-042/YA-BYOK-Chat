<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineEmits<{
  (e: 'openSettings'): void
}>()

const { t, locale } = useI18n()

const REPO_URL = 'https://github.com/Laurence-042/YA-BYOK-Chat'
</script>

<template>
  <div class="header">
    <div>
      <h1>{{ t('appTitle') }}</h1>
      <p>{{ t('appSubtitle') }}</p>
    </div>
    <div class="header-right">
      <el-select v-model="locale" class="lang-select" size="large">
        <el-option value="zh" label="中文" />
        <el-option value="en" label="English" />
      </el-select>
      <el-button size="large" @click="$emit('openSettings')">{{ t('settings') }}</el-button>
      <a
        :href="REPO_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="repo-link"
        :title="t('repoLink')"
        :aria-label="t('repoLink')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.28-1.67-1.28-1.67-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.6.23 2.78.11 3.07.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.13 0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"
          />
        </svg>
      </a>
    </div>
  </div>
</template>
