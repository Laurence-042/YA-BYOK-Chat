# YA-BYOK-Chat

Yet Another BYOK Chat（Vue + TS + Element Plus）。

## 特性

- 简洁配置：Endpoint / API Key / Model / System Prompt / Temperature
- URL 分享配置：可一键复制分享链接，打开即自动填入配置
- URL 长度提示：超过安全长度会提示风险
- 中英文界面（i18n）
- 适配非根路径部署（Vite `base: './'`）
- 对话体验：Enter 发送 / Shift+Enter 换行，输入法友好；回复保留换行；等待回复时显示打字指示
- 长对话自动摘要：超过阈值后将早期消息压缩为摘要，节省上下文（可在设置中关闭）
- 异常诊断：请求失败时弹出诊断信息对话框，一键复制（已自动隐去 API Key）发送给开发者排查

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```
