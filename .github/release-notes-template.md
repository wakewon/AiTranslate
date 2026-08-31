AiTranslate 是一个面向 Bob 的通用 AI 翻译插件，基于请求格式而不是服务商名称建模。无论你使用 OpenAI、Anthropic、Gemini 原生接口，还是 DeepSeek、智谱、硅基流动、Ollama 等兼容服务，都可以通过同一个插件完成配置。

#### ✨ 核心能力
- **多种请求格式**：支持 OpenAI Chat Completions、Responses API、Legacy Completions、Anthropic Messages、Anthropic OpenAI 兼容、Gemini generateContent 与 Gemini OpenAI 兼容格式。
- **高度可配置**：可自由设置 Base URL、端点路径，并注入额外请求头、查询参数和请求体，适配不同服务商及高级参数。
- **流式输出**：支持 SSE 流式响应，与 Bob 的实时翻译体验保持一致。
- **配置辅助工具**：提供在线文档和高级参数构建工具，便于生成复杂 JSON 配置。

#### 🚀 本次更新（v{{VERSION}}）
{{CHANGES}}

#### 📦 安装方法
1. 在下方 **Assets** 中下载 `{{PACKAGE_NAME}}`。
2. 双击 `.bobplugin` 文件，Bob 会自动完成插件安装或升级。
3. 在 Bob 的服务设置中填写 API 地址、API Key 和模型名称即可使用。

#### 📖 文档与反馈
- 使用文档与配置教程：https://wakewon.wwang.de/AiTranslate/
- 如果遇到兼容性问题或希望支持新的接口格式，欢迎在 GitHub Issues 中反馈。
