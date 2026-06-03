# YA-BYOK-Chat

> Yet Another Bring-Your-Own-Key Chat — a minimal single-page chat app for OpenAI-compatible APIs.

面向**非技术用户**设计：技术人员配置一次，生成分享链接，收到链接的人打开即可直接聊天，无需填写任何设置。

[在线 Demo](https://blog.laurence042.com/project/ya-byok-chat/demo/)

## 功能

- **开箱即用的分享链接** — 配置（Endpoint / API Key / 模型 / 系统提示词等）编码进 URL，一键复制，对方打开即自动填入
- **兼容所有 OpenAI 格式 API** — 只需填入 Base URL，支持 OpenAI、Azure、本地 Ollama、各类代理等
- **Markdown & Mermaid 渲染** — 助手回复支持富文本格式和流程图
- **长对话自动摘要** — 消息超过阈值后自动将早期对话压缩为摘要，节省上下文窗口（可关闭）
- **异常诊断** — 请求失败时弹出诊断对话框，一键复制（API Key 已脱敏）方便排查
- **中 / 英文界面切换**
- **配置本地持久化** — 设置和聊天记录存于 `localStorage`，刷新不丢失
- **Cloudflare Worker KV 日志（可选）** — 在设置中填入 Worker 地址后，每轮对话结束时自动将收发消息 POST 至 Cloudflare Worker 写入 KV 存储；Worker 地址和鉴权 token 同样可通过分享链接传递

## 技术栈

Vue 3 + TypeScript · Vite · Element Plus · vue-i18n · marked · Mermaid

## 本地开发

```bash
npm install
npm run dev      # 启动开发服务器
npm run build    # 类型检查 + 构建产物
npm run preview  # 预览构建结果
```

## 部署说明

构建产物为纯静态文件，可托管在任意路径（非根路径同样支持）。`vite.config.ts` 中 `base: './'` 不可修改。

## Cloudflare Worker KV 日志（可选）

`worker/` 子目录包含一个 Cloudflare Worker，用于将聊天记录写入 KV 存储。

### 首次部署

```bash
cd worker
npm install

# 登录 Cloudflare（首次需要）
npx wrangler login

# 创建 KV namespace，记录返回的 id
npx wrangler kv namespace create YA_BYOK_Chat_LOG

# 将上面返回的 id 填入 wrangler.toml 中的 id 字段
# （本地调试还需创建 preview namespace 并填入 preview_id）
npx wrangler kv namespace create YA_BYOK_Chat_LOG --preview

# 如需 Token 鉴权，设置 secret（部署后在 Cloudflare Dashboard 也可设置）
npx wrangler secret put TOKEN

# 部署
npm run deploy
```

部署成功后，将 Worker 地址填入设置面板的「Cloudflare Worker KV 日志 → Worker 地址」，即可在每次对话后自动上报消息。

### 本地调试

```bash
cd worker
npm run dev
```

## 致谢 / Acknowledgements

高级设置项（temperature / max tokens / summarize-after / retain-last-N 等）的交互设计参考了
[0xarchit/ByokChat](https://github.com/0xarchit/ByokChat)（MIT License）。感谢原作者以开源协议开放其工作。
本项目与 ByokChat 无隶属关系，所有代码均独立编写。

The advanced settings panel (temperature / max tokens / summarize-after / retain-last-N)
takes design inspiration from [0xarchit/ByokChat](https://github.com/0xarchit/ByokChat) (MIT License).
This project is not affiliated with ByokChat; all code is independently written.

## License

Released under the terms in [LICENSE](LICENSE).
