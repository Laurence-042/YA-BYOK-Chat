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

The app is intentionally small. Logic is split between a thin root component, a few presentational components, and a handful of composables:

| Path | Purpose |
|------|---------|
| [src/App.vue](src/App.vue) | Root component: wires composables together and renders child components |
| [src/types.ts](src/types.ts) | Shared types (`ChatMessage`, `ShareConfig`, `Diagnostics`) and tunable bounds |
| [src/composables/useConfig.ts](src/composables/useConfig.ts) | Reactive `form` config, localStorage persistence, share-URL encode/decode |
| [src/composables/useModels.ts](src/composables/useModels.ts) | Debounced `GET {base}models` fetch |
| [src/composables/useChat.ts](src/composables/useChat.ts) | Chat state, `chat/completions` calls, auto-summarization, diagnostics |
| [src/components/AppHeader.vue](src/components/AppHeader.vue) | Title, locale switcher, settings button, repo link |
| [src/components/ModelBar.vue](src/components/ModelBar.vue) | Model selector + clear-chat button |
| [src/components/SummaryBar.vue](src/components/SummaryBar.vue) | Running-summary banner |
| [src/components/ChatPanel.vue](src/components/ChatPanel.vue) | Message list, typing indicator, auto-scroll |
| [src/components/ChatComposer.vue](src/components/ChatComposer.vue) | Textarea + send button; owns the draft message |
| [src/components/SettingsDrawer.vue](src/components/SettingsDrawer.vue) | Endpoint/key/system-prompt/advanced form + share button |
| [src/components/DiagnosticsDialog.vue](src/components/DiagnosticsDialog.vue) | Failure diagnostics dialog |
| [src/i18n.ts](src/i18n.ts) | `vue-i18n` setup; all translation strings for `zh` and `en` |

There is no router and no Pinia/Vuex — shared state lives in the composables. Keep the component graph shallow; only split further when a piece of UI is genuinely reused or has grown unwieldy.

## Key Conventions

- **Element Plus** for all UI: use `el-*` components; import icons from `@element-plus/icons-vue`.
- **vue-i18n**: every user-visible string must have a key in both `zh` and `en` locales in [src/i18n.ts](src/i18n.ts). Access via `t('key')` inside `<script setup>`.
- **Vite base `'./'`**: required for non-root deployments; do not change.
- **Share URL**: config is base64url-encoded (URL-safe: `+→-`, `/→_`, no padding). The safety threshold is `MAX_SHARE_URL_LENGTH = 1800` chars.
- **API format**: OpenAI-compatible — `GET {base}models` and `POST {base}chat/completions`. The base URL is normalised to always end with `/` before appending the path.
- **LocalStorage keys**: `byok-config` (form state) and `byok-messages` (chat history). Persisted reactively via `watch`.
- **Security**: API keys are never logged or included in error messages. `isValidShareConfig` validates URL-loaded config before applying it (checks `https?://` prefix, non-empty key/model).
- **TypeScript**: strict mode via `@vue/tsconfig`. Avoid `any`; cast through `unknown` when deserialising external data.
