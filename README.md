<div align="center">
  <img src="icon-large.png" alt="AiTranslate Logo" width="128" height="128" style="border-radius: 20px;">
  <h1>Ai 翻译</h1>
  <p>一个插件，搞定所有大模型。基于请求格式建模的 Bob 通用 AI 翻译插件。</p>
</div>

## ✨ 特性

- 🔄 **7 种请求格式** — 覆盖 OpenAI Chat / Responses / Completions、Anthropic Claude、Gemini 原生及 OpenAI 兼容格式
- 🌐 **通用兼容** — 支持所有 OpenAI 兼容接口（DeepSeek、SiliconFlow、OpenRouter、Groq、Together、Ollama、LM Studio 等）
- 🔑 **认证自动化** — 根据请求格式自动处理 Bearer Token / x-api-key / Query Key 认证
- 🛠 **Postman 式扩展** — 通过 JSON 字段自由添加任意请求头、查询参数和请求体参数
- 🌊 **流式输出** — 支持 SSE 流式翻译，实时显示翻译结果
- 📝 **自定义提示词** — 支持 `$text`、`$sourceLang`、`$targetLang` 变量
- 🌍 **100+ 语言** — 支持全球主流语言

## 📦 安装

1. 下载最新的 `.bobplugin` 文件
2. 双击安装到 Bob
3. 在 Bob 偏好设置中配置插件

## 📚 文档中心

我们提供了详尽的官方文档，包含基础配置教程、如何关闭推理模型深度思考等进阶玩法。文档内还内置了**交互式 AI 提示词生成器**，只需输入你的服务商和模型名称，即可一键生成给大模型（如 ChatGPT / Claude）的提示词，让 AI 直接为你写好配置参数，彻底告别配错参数的烦恼！

👉 **[在线访问文档中心](https://wakewon.wwang.de/AiTranslate/docs/index.html)**

## ⚙️ 配置示例

### OpenAI / ChatGPT

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Responses API |
| Base URL | `https://api.openai.com` |
| API Key | `sk-xxxx` |
| 模型 | `gpt-5.5` |

*注：推荐使用 Responses API 格式，便于在“额外请求体”中注入 `{"reasoning_effort": "none"}` 等高级参数来调节或关闭思考强度。*



### Anthropic Claude

| 选项 | 值 |
|---|---|
| 请求格式 | Anthropic Claude Messages |
| Base URL | `https://api.anthropic.com` |
| API Key | `sk-ant-xxxx` |
| 模型 | `claude-opus-4-8` |

### Google Gemini

| 选项 | 值 |
|---|---|
| 请求格式 | Gemini generateContent |
| Base URL | `https://generativelanguage.googleapis.com` |
| API Key | `AIzaSyxxxx` |
| 模型 | `gemini-3.5-flash` |

### DeepSeek

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Chat Completions（通用兼容） |
| Base URL | `https://api.deepseek.com` |
| API Key | `sk-xxxx` |
| 模型 | `deepseek-v4-flash` |

### SiliconFlow

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Chat Completions（通用兼容） |
| Base URL | `https://api.siliconflow.cn` |
| API Key | `sk-xxxx` |
| 模型 | `deepseek-ai/deepseek-v4-flash` |

### 智谱 GLM

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Chat Completions（通用兼容） |
| Base URL | `https://open.bigmodel.cn` |
| 自定义端点 | `/api/paas/v4/chat/completions` |
| API Key | `您的智谱 API Key` |
| 模型 | `glm-4-flash` |

*注：智谱的 API 路径比较特殊，必须填写“自定义端点”进行覆盖。*

### Ollama（本地）

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Chat Completions（通用兼容） |
| Base URL | `http://localhost:11434` |
| API Key | `ollama`（任意非空值即可） |
| 模型 | `qwen2.5` |

## 📝 提示词变量

在「自定义系统指令」和「自定义用户指令」中可使用以下变量：

| 变量 | 说明 | 示例值 |
|---|---|---|
| `$text` | 需要翻译的原文 | `Hello World` |
| `$sourceLang` | 检测到的源语言 | `English` |
| `$targetLang` | 目标语言 | `Simplified Chinese` |

### 默认提示词

- **系统指令**: `You are a translation engine that can only translate text and cannot interpret it.`
- **用户指令**: `translate from $sourceLang to $targetLang:\n\n$text`

### 自定义示例

系统指令：
```
你是一个专业的翻译引擎，只能翻译文本，不能解释。
```

用户指令：
```
将以下 $sourceLang 文本翻译成 $targetLang，只输出翻译结果：

$text
```

## 🔧 扩展参数

通过「额外请求头」「额外查询参数」「额外请求体」三个 JSON 字段，可以添加任意自定义参数。

### 额外请求体示例

```json
{
  "top_p": 0.9,
  "frequency_penalty": 0.5,
  "presence_penalty": 0.3
}
```

### 参数构建工具

我们提供了一个图形化的参数构建工具，帮助你可视化地添加参数并一键生成 JSON 配置，免去手动拼接的烦恼。

👉 **[在线访问参数构建工具](https://wakewon.wwang.de/AiTranslate/tools/param-builder.html)**

## 🚀 打包部署

你可以使用项目自带的脚本一键打包：

```bash
./build.sh
```

生成的安装包将存放在 `release/` 目录中。

## 📄 License

MIT

## 🙏 鸣谢

- [Bob](https://bobtranslate.com) — 强大的 macOS 翻译工具
- [bob-plugin-openai-translator](https://github.com/nextai-translator/bob-plugin-openai-translator) — 参考实现
