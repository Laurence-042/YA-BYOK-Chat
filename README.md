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

## 致谢 / Acknowledgements

设置项的能力对标（temperature / max tokens / summarize-after / retain-last-N 等）参考了
[0xarchit/ByokChat](https://github.com/0xarchit/ByokChat)（MIT License）的设计思路。感谢
该项目作者将其工作以开源协议开放，让本项目得以在尊重原作的前提下借鉴其交互范式。本仓库与
该项目无隶属关系；具体实现与代码均为独立编写。

The advanced settings surface (temperature / max tokens / summarize-after / retain-last-N)
takes design inspiration from [0xarchit/ByokChat](https://github.com/0xarchit/ByokChat),
licensed under the MIT License. Thanks to the author for releasing their work under an
open-source license. This project is not affiliated with ByokChat; all code here is
independently written.

## License

Released under the terms in [LICENSE](LICENSE).
