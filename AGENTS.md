# YA-BYOK-Chat — Agent Instructions

Yet Another BYOK Chat: a single-page Vue 3 + TypeScript app that lets users chat with any OpenAI-compatible API endpoint. Config (endpoint, key, model, system prompt) is stored in `localStorage` and can be shared via a URL-encoded `?c=` query parameter.

## Background & Design Intent

**Target user**: non-technical users (e.g. a parent). Existing BYOK chat sites expose concepts like provider selection, temperature, token limits, import/export settings — too much for someone unfamiliar with LLM APIs.

**Core goal**: make it trivially easy for a tech-savvy person to configure the app once and share a single URL that loads the full config automatically. The recipient clicks the link, sees the chat box ready to use — nothing to fill in.

**Deployment**: the app is hosted at a non-root subpath (e.g. `https://blog.laurence042.com/project/yabyokchat/demo/`) via [this GitHub Actions workflow](https://github.com/Laurence-042/Laurence-042.github.io/blob/main/.github/workflows/deploy-projects.yaml). This is why `base: './'` in `vite.config.ts` must never be changed.

**Design philosophy**: keep the UI as simple as a consumer chat app. Resist adding power-user features (temperature sliders, system prompt editor visible by default, model parameters, token counters, etc.) unless explicitly requested. Every new option is a potential point of confusion for the target user.

## Commands

```bash
npm run dev        # dev server (Vite)
npm run build      # type-check (vue-tsc) then Vite build
npm run preview    # preview production build
```

No test runner is configured.

## Architecture

The app is intentionally minimal — nearly all logic lives in two files:

| File | Purpose |
|------|---------|
| [src/App.vue](src/App.vue) | Single root component: all state, UI, API calls, share-link logic |
| [src/i18n.ts](src/i18n.ts) | `vue-i18n` setup; all translation strings for `zh` and `en` |

There is no router, no Pinia/Vuex, and no component split — keep it that way unless the user explicitly asks.

## Key Conventions

- **Element Plus** for all UI: use `el-*` components; import icons from `@element-plus/icons-vue`.
- **vue-i18n**: every user-visible string must have a key in both `zh` and `en` locales in [src/i18n.ts](src/i18n.ts). Access via `t('key')` inside `<script setup>`.
- **Vite base `'./'`**: required for non-root deployments; do not change.
- **Share URL**: config is base64url-encoded (URL-safe: `+→-`, `/→_`, no padding). The safety threshold is `MAX_SHARE_URL_LENGTH = 1800` chars.
- **API format**: OpenAI-compatible — `GET {base}models` and `POST {base}chat/completions`. The base URL is normalised to always end with `/` before appending the path.
- **LocalStorage keys**: `byok-config` (form state) and `byok-messages` (chat history). Persisted reactively via `watch`.
- **Security**: API keys are never logged or included in error messages. `isValidShareConfig` validates URL-loaded config before applying it (checks `https?://` prefix, non-empty key/model).
- **TypeScript**: strict mode via `@vue/tsconfig`. Avoid `any`; cast through `unknown` when deserialising external data.
