# AiTranslate

AiTranslate 让你在 Mac 上选中一句话，直接用 Bob 阅读译文。可以用已有的翻译服务或本地模型，也可以先用免密钥的 bilibili 翻译试一下。

[下载插件](https://github.com/wakewon/AiTranslate/releases/latest) · [第一次使用指南](https://wakewon.wwang.de/AiTranslate/docs/basic-usage.html) · [选择翻译服务](https://wakewon.wwang.de/AiTranslate/#providers)

<a id="-安装"></a>

## 翻译第一句话

1. 在装有 Bob 1.8.0 或更高版本的 Mac 上，双击下载的 `.bobplugin` 文件。
2. 打开 Bob「偏好设置 → 翻译 → 服务」，在「文本翻译」列表下点加号，选择「Ai 翻译」。
3. 打开配置助手，选用 bilibili 翻译，把助手列出的地址和模型复制到 Bob，选择对应的下拉选项。API Key 可以留空。[打开 bilibili 配置](https://wakewon.wwang.de/AiTranslate/tools/param-builder.html?provider=bilibili#connection)
4. 点击「验证」，开启服务并保存。在 Bob 中选择简体中文，输入 `See you tomorrow.` 后按回车，查看译文。

<a id="-配置示例"></a>
<a id="ollama本地"></a>

已经有云服务密钥，或在 Mac 上运行 Ollama、LM Studio？在配置助手中选择对应的服务即可。指南里也介绍了如何申请密钥，以及到哪里复制本地模型的名称。[使用其他云服务或本地模型](https://wakewon.wwang.de/AiTranslate/docs/basic-usage.html#prepare)

<a id="-特性"></a>
<a id="-文档中心"></a>

## 接入其他服务

选择实际提供翻译的平台，就能查看 Bob 里的填法。服务商给你的 **API Key** 用于确认账号，**模型**是该平台上负责翻译的具体程序。[查找服务商](https://wakewon.wwang.de/AiTranslate/#providers)

常用服务可以从这里直接打开。<a id="openai--chatgpt" href="https://wakewon.wwang.de/AiTranslate/tools/param-builder.html?provider=openai">OpenAI</a> · <a id="anthropic-claude" href="https://wakewon.wwang.de/AiTranslate/tools/param-builder.html?provider=anthropic">Claude</a> · <a id="google-gemini" href="https://wakewon.wwang.de/AiTranslate/tools/param-builder.html?provider=gemini">Gemini</a> · <a id="deepseek" href="https://wakewon.wwang.de/AiTranslate/tools/param-builder.html?provider=deepseek">DeepSeek</a> · <a id="siliconflow" href="https://wakewon.wwang.de/AiTranslate/tools/param-builder.html?provider=siliconflow">硅基流动</a> · <a id="智谱-glm" href="https://wakewon.wwang.de/AiTranslate/tools/param-builder.html?provider=glm">智谱 GLM</a>

<details>
<summary id="鉴权方式">使用自建服务或需要手动填写接口</summary>

插件支持 OpenAI、Claude、Gemini 等七种请求格式，可覆盖接口路径和密钥的发送方式。Azure OpenAI 使用部署名，本地服务使用服务器列出的模型 ID。[接口默认路径](https://wakewon.wwang.de/AiTranslate/docs/basic-usage.html#format) · [模型 ID](https://wakewon.wwang.de/AiTranslate/docs/basic-usage.html#model-ids) · [鉴权方式](https://wakewon.wwang.de/AiTranslate/docs/basic-usage.html#authentication)

</details>

<a id="-提示词变量"></a>

## 自定义翻译指令

<a id="默认提示词"></a>

系统指令和用户指令都可以留空。默认情况下，插件要求模型将选中的文字从源语言翻译到目标语言。希望保留术语、代码或段落时，可以将长期使用的要求写入「自定义系统指令」。

<a id="自定义示例"></a>

**系统指令示例**

```text
你是技术文档译者。保留代码、变量名和 Markdown 结构，只输出译文。
```

**用户指令示例**

```text
请将下面的 $sourceLang 原文译成 $targetLang。

$text
```

插件会把 `$text` 换成原文，把 `$sourceLang` 和 `$targetLang` 换成语言名称。配置助手也能按所选服务生成翻译指令，以及用于向 AI 助手查询配置的提示词。[在配置助手生成提示词](https://wakewon.wwang.de/AiTranslate/tools/param-builder.html#prompts)

<a id="-扩展参数"></a>

## 额外请求参数

<a id="参数构建工具"></a>
<a id="额外请求体示例"></a>

「额外请求头」「额外查询参数」「额外请求体」都接收 JSON 对象。自定义请求头可以覆盖同名默认值。额外请求体会与插件构造的数据合并，适合填写当前模型支持的推理参数等设置。配置助手可编辑和复制 JSON。[编辑参数](https://wakewon.wwang.de/AiTranslate/tools/param-builder.html#parameters) · [按模型调整推理强度](https://wakewon.wwang.de/AiTranslate/docs/disable-thinking.html)

<a id="-版本兼容"></a>

## 版本兼容

插件需要 Bob 1.8.0 或更高版本，默认开启流式输出。端点支持流式响应时，Bob 会在生成过程中陆续显示译文。

| 运行环境 | 译文显示 |
| --- | --- |
| Bob 1.8.0–1.20.x | 纯文本 |
| Bob 1.21.0 及以上，macOS 12 | 纯文本 |
| Bob 1.21.0 及以上，macOS 13 及以上 | 默认渲染 Markdown，可在插件中关闭 |

翻译代码、公式时，如果需要看到原始标记，可以关闭本插件的「Markdown 渲染」。Bob「偏好设置 → 翻译 → Markdown」中的开关控制所有服务。[Bob 的 Markdown 支持说明](https://bobtranslate.com/blog/2026-09-21-markdown-plugin.html)

## 服务商目录维护

服务商的地址、请求格式、鉴权方式和官方资料保存在 [data/providers.json](data/providers.json)。新增服务、端点改版和鉴权变更由维护者对照官方文档审核。已下线的服务会保留状态说明，配置助手不再提供可复制的连接配置。自建端点可以手动填写地址和模型 ID。账号可用的模型、Azure 部署名和本地模型，请从自己的控制台或服务器查询。

GitHub Actions 从八个官方来源更新[模型快照](data/model-catalog.json)，无需服务商密钥或额外的 AI API。快照记录模型 ID，以及来源明确公布的上下文窗口、最大输出长度等字段。

| 来源 | 收录范围 |
| --- | --- |
| OpenAI、Anthropic、DeepSeek | OpenAI 官方精选中支持 Chat Completions 的文本模型，Claude 与 DeepSeek 官方目录中的当前型号 |
| Google Gemini | Google 型号目录和原生 `generateContent` 推理指南均列出的通用文本模型，记录各型号的思考等级和同步请求的输出上限 |
| Groq、bilibili | Groq 生产环境的文本对话模型，bilibili 公共翻译端点列出的翻译模型 |
| OpenRouter、AIHubMix | 各平台公开目录中的文本聊天模型，OpenRouter 另列出每个模型支持的参数名称 |

其他服务商沿用人工核对的预设。要了解某个参数允许的值，请查该模型在实际端点使用的接口文档。

工作流合入默认分支后，每周一 04:17 UTC 自动检查，也可在 Actions 中手动运行。快照有变更且通过校验时，工作流会通过 GitHub Contents API 更新默认分支的 `data/model-catalog.json`。写入时会核对文件的 SHA，避免覆盖其他人刚提交的修改。若线上快照尚未更新，工作流会请求 GitHub Pages 重新构建网站。[查看工作流](.github/workflows/model-catalog.yml)

个别服务商暂时无法访问或返回格式发生变化时，保留该来源上次通过校验的数据。若写入默认分支受限，可从该次 Actions 运行的 Artifacts 下载 `model-catalog`，取出已校验的快照。

在本地使用 Python 3.10 或更高版本，运行 `python3 scripts/update-model-catalog.py` 可以刷新快照，追加 `--check` 则使用已保存的文件做离线校验。

<a id="-打包部署"></a>

## 本地预览与打包

在仓库根目录运行静态文件服务器，然后在浏览器打开 <http://localhost:8000>。

```sh
python3 -m http.server 8000
```

运行 `./build.sh` 可生成安装包，产物位于 `release/`。脚本需要 `python3`、`jq` 和 `zip`。

<a id="-license"></a>
<a id="-鸣谢"></a>

## 许可与鸣谢

本项目采用 MIT 许可。感谢 [Bob](https://bobtranslate.com/) 提供插件接口，项目参考了 [bob-plugin-openai-translator](https://github.com/nextai-translator/bob-plugin-openai-translator) 的实现。
