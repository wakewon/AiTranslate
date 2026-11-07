<div align="center">
  <img src="icon-large.png" alt="AiTranslate Logo" width="128" height="128" style="border-radius: 20px;">
  <h1>Ai 翻译</h1>
  <p>一个插件，搞定所有大模型。基于请求格式建模的 Bob 通用 AI 翻译插件。</p>
</div>

## ✨ 特性

- 🔄 **7 种请求格式** — 覆盖 OpenAI Chat / Responses / Completions、Anthropic Claude、Gemini 原生及 OpenAI 兼容格式
- 🌐 **通用兼容** — 支持常见的 OpenAI 兼容接口（DeepSeek、SiliconFlow、OpenRouter、Groq、Together、Ollama、LM Studio 等）
- 🔑 **鉴权方式** — 按请求格式自动选择，也可指定请求头、查询参数或手动配置
- 🛠 **Postman 式扩展** — 通过 JSON 字段自由添加任意请求头、查询参数和请求体参数
- 🌊 **流式输出** — 支持 SSE 流式翻译，实时显示翻译结果
- 🧾 **Markdown 渲染** — 适配 Bob 1.21.0+（需 macOS 13+），标题、列表、代码块、表格等模型输出可直接渲染，流式输出时边收边渲染；可在插件选项中一键切换为纯文本。低版本 Bob 自动按纯文本显示，不影响使用（详见[版本兼容](#-版本兼容)）
- 📝 **自定义提示词** — 支持 `$text`、`$sourceLang`、`$targetLang` 变量
- 🌍 **100+ 语言** — 支持全球主流语言

## 📦 安装

> 支持 Bob 1.8.0 及以上版本。其中 Markdown 渲染需要 Bob 1.21.0+ 且 macOS 13+，详见下方[版本兼容](#-版本兼容)。

1. 下载最新的 `.bobplugin` 文件
2. 双击安装到 Bob
3. 在 Bob 偏好设置中配置插件

## 🖥 版本兼容

插件最低支持 Bob 1.8.0（流式输出所需的接口从该版本开始提供），各版本均支持流式输出。**Markdown 渲染是 Bob 1.21.0 新增的能力**，插件同时兼容新旧版本：

| 运行环境 | 译文显示 |
|---|---|
| Bob 1.8.0 ~ 1.20.x | 纯文本。「Markdown 渲染」选项**不起作用** |
| Bob 1.21.0+ · macOS 13+ | 按「Markdown 渲染」选项显示，**默认开启**；关闭则为纯文本 |
| Bob 1.21.0+ · macOS 12 | 纯文本（Markdown 渲染需要 macOS 13 及以上） |

**低版本 Bob 会出问题吗？** 不会报错，也不影响翻译。Bob 1.21.0 之前不识别新的译文结构，插件同时回传了旧版结构，所以低版本的显示效果和更新前一致。唯一的区别是：如果模型输出了 Markdown 语法，`#`、`**`、`|` 之类的标记会原样显示。遇到这种情况，可以在「自定义系统指令」中要求模型只输出纯文本。

**高版本 Bob 中不想渲染怎么办？** 有两处开关：

- 插件选项里的「Markdown 渲染」：只影响本插件。
- Bob「偏好设置 - 翻译 - Markdown」：全局关闭所有服务的 Markdown 渲染。

翻译源码、公式、含有大量 `*` `_` `#` `|` 符号的文本时，如果被误渲染，可以关闭该选项。

## 📚 文档中心

文档中心包含基础配置、服务鉴权和推理参数教程。**交互式提示词生成器**可根据服务商和模型生成配置查询提示词，要求 AI 助手按实际端点核对鉴权和参数并附上官方来源。

👉 **[在线访问文档中心](https://wakewon.wwang.de/AiTranslate/docs/index.html)**

## ⚙️ 配置示例

模型 ID 按实际服务、账号和地区选择。Azure OpenAI 使用部署名，自托管服务使用本机列出的 ID。[各服务的模型 ID 示例和官方目录](docs/basic-usage.html#model-ids)

### 鉴权方式

「自动（按请求格式）」默认使用 Bearer，Gemini 原生格式默认使用 `x-goog-api-key`。[Claude 鉴权](https://platform.claude.com/docs/en/manage-claude/authentication) · [Gemini 鉴权](https://ai.google.dev/api#authentication)

也可以选择 `Authorization: Bearer`、`x-api-key`、`x-goog-api-key`、`api-key` 或 URL 查询参数 `key`，再将原始密钥填入「API Key」。例如，Azure OpenAI 可选择 `api-key`，只接受 URL 密钥的 Gemini 代理可选择 URL 查询参数 `key`。

API Key 留空或选择「手动或无需鉴权」时，插件省略自动鉴权。官方托管推理端点仍要求有效凭据，可以由插件的 API Key 字段发送，也可以通过额外请求头或查询参数提供。Ollama 本地和默认的 LM Studio 可以留空，前提是连接的服务或代理没有开启鉴权。[逐个服务的鉴权对照](docs/basic-usage.html#authentication)

### OpenAI / ChatGPT

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Responses API |
| Base URL | `https://api.openai.com` |
| API Key | `sk-xxxx` |
| 模型 | `gpt-6-luna` |

`gpt-6-luna` 的 Responses API 支持在「额外请求体」加入 `{"reasoning":{"effort":"none"}}`。切换模型后按该模型支持的档位填写。[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)



### Anthropic Claude

| 选项 | 值 |
|---|---|
| 请求格式 | Anthropic Claude Messages |
| Base URL | `https://api.anthropic.com` |
| API Key | `sk-ant-xxxx` |
| 模型 | `claude-haiku-5-5` |

需要旧版 `x-api-key` 时，在「鉴权方式」中选择对应请求头。使用跨工作区密钥直连 Claude API 时，在「额外请求头」中添加 `anthropic-workspace-id`。[Claude 鉴权文档](https://platform.claude.com/docs/en/manage-claude/authentication)

### Google Gemini

| 选项 | 值 |
|---|---|
| 请求格式 | Gemini generateContent |
| Base URL | `https://generativelanguage.googleapis.com` |
| API Key | Google AI Studio 中的有效 API Key |
| 模型 | `gemini-3.8-flash` |

「端点路径覆盖」留空时，插件从「模型」字段读取 ID 并自动拼接路径。手动覆盖时，路径里的 `{model}` 需要换成实际 ID。[Gemini 端点配置](docs/basic-usage.html#gemini-endpoint)

### DeepSeek

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Chat Completions（通用兼容） |
| Base URL | `https://api.deepseek.com` |
| API Key | `sk-xxxx` |
| 模型 | `deepseek-flash` |

DeepSeek 官方推荐用 `deepseek-flash` 调用当前的 Flash 模型。[DeepSeek 模型目录](https://api-docs.deepseek.com/quick_start/pricing/)

### SiliconFlow

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Chat Completions（通用兼容） |
| Base URL | `https://api.siliconflow.cn` |
| API Key | `sk-xxxx` |
| 模型 | `deepseek-ai/DeepSeek-V4.1-Flash` |

### 智谱 GLM

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Chat Completions（通用兼容） |
| Base URL | `https://open.bigmodel.cn` |
| 自定义端点 | `/api/paas/v4/chat/completions` |
| API Key | `您的智谱 API Key` |
| 模型 | `glm-5.3` |

*注：智谱的 API 路径比较特殊，必须填写“自定义端点”进行覆盖。*

### Ollama（本地）

| 选项 | 值 |
|---|---|
| 请求格式 | OpenAI Chat Completions（通用兼容） |
| Base URL | `http://localhost:11434` |
| API Key | 留空 |
| 模型 | `ollama list` 中的实际模型名，例如 `qwen3.8:27b` |

本地 HTTP 接口无需占位密钥。官方示例中的 `api_key="ollama"` 用于构造 OpenAI SDK 客户端。直接请求 `ollama.com` 的云端 API 时，使用有效的 Ollama 密钥和 Bearer 鉴权。[本地兼容接口](https://docs.ollama.com/api/openai-compatibility) · [Ollama 鉴权](https://docs.ollama.com/api/authentication)

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

自动模式优先使用自行配置的 `Authorization`、`x-api-key`、`x-goog-api-key`、`api-key` 或 URL 查询参数 `key`。手动指定密钥的发送方式时，同名的自定义值优先。例如，可在「额外请求头」中填写 `{"Authorization": "Bearer YOUR_TOKEN"}`。请求头名称不区分大小写。

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
