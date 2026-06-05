/**
 * Ai 翻译 — Bob 通用 AI 翻译插件
 * 
 * 支持 OpenAI / Anthropic / Gemini 等主流 API 格式，
 * 通过选择"请求格式"切换适配器，一个插件搞定所有 AI 翻译服务。
 * 
 * @author wakewon
 * @homepage https://github.com/wakewon
 * @license MIT
 */

// ============================================================================
// 第一段：语言映射
// ============================================================================

var supportLanguageList = [
    ['auto', 'auto'],
    ['zh-Hans', 'Simplified Chinese'],
    ['zh-Hant', 'Traditional Chinese'],
    ['en', 'English'],
    ['ja', 'Japanese'],
    ['ko', 'Korean'],
    ['fr', 'French'],
    ['de', 'German'],
    ['es', 'Spanish'],
    ['it', 'Italian'],
    ['ru', 'Russian'],
    ['pt', 'Portuguese'],
    ['nl', 'Dutch'],
    ['pl', 'Polish'],
    ['ar', 'Arabic'],
    ['af', 'Afrikaans'],
    ['am', 'Amharic'],
    ['az', 'Azerbaijani'],
    ['be', 'Belarusian'],
    ['bg', 'Bulgarian'],
    ['bn', 'Bengali'],
    ['bs', 'Bosnian'],
    ['ca', 'Catalan'],
    ['ceb', 'Cebuano'],
    ['cs', 'Czech'],
    ['cy', 'Welsh'],
    ['da', 'Danish'],
    ['el', 'Greek'],
    ['et', 'Estonian'],
    ['eu', 'Basque'],
    ['fa', 'Persian'],
    ['fi', 'Finnish'],
    ['fil', 'Filipino'],
    ['ga', 'Irish'],
    ['gl', 'Galician'],
    ['gu', 'Gujarati'],
    ['ha', 'Hausa'],
    ['he', 'Hebrew'],
    ['hi', 'Hindi'],
    ['hmn', 'Hmong'],
    ['hr', 'Croatian'],
    ['ht', 'Haitian Creole'],
    ['hu', 'Hungarian'],
    ['hy', 'Armenian'],
    ['id', 'Indonesian'],
    ['ig', 'Igbo'],
    ['is', 'Icelandic'],
    ['jw', 'Javanese'],
    ['ka', 'Georgian'],
    ['kk', 'Kazakh'],
    ['km', 'Khmer'],
    ['kn', 'Kannada'],
    ['ku', 'Kurdish'],
    ['ky', 'Kyrgyz'],
    ['la', 'Latin'],
    ['lb', 'Luxembourgish'],
    ['lo', 'Lao'],
    ['lt', 'Lithuanian'],
    ['lv', 'Latvian'],
    ['mg', 'Malagasy'],
    ['mi', 'Maori'],
    ['mk', 'Macedonian'],
    ['ml', 'Malayalam'],
    ['mn', 'Mongolian'],
    ['mr', 'Marathi'],
    ['ms', 'Malay'],
    ['mt', 'Maltese'],
    ['my', 'Myanmar'],
    ['ne', 'Nepali'],
    ['no', 'Norwegian'],
    ['ny', 'Chichewa'],
    ['pa', 'Punjabi'],
    ['ps', 'Pashto'],
    ['ro', 'Romanian'],
    ['si', 'Sinhala'],
    ['sk', 'Slovak'],
    ['sl', 'Slovenian'],
    ['sm', 'Samoan'],
    ['sn', 'Shona'],
    ['so', 'Somali'],
    ['sq', 'Albanian'],
    ['sr', 'Serbian'],
    ['sr-Cyrl', 'Serbian (Cyrillic)'],
    ['sr-Latn', 'Serbian (Latin)'],
    ['st', 'Sesotho'],
    ['su', 'Sundanese'],
    ['sv', 'Swedish'],
    ['sw', 'Swahili'],
    ['ta', 'Tamil'],
    ['te', 'Telugu'],
    ['tg', 'Tajik'],
    ['th', 'Thai'],
    ['tk', 'Turkmen'],
    ['tl', 'Tagalog'],
    ['tr', 'Turkish'],
    ['tt', 'Tatar'],
    ['ug', 'Uyghur'],
    ['uk', 'Ukrainian'],
    ['ur', 'Urdu'],
    ['uz', 'Uzbek'],
    ['vi', 'Vietnamese'],
    ['xh', 'Xhosa'],
    ['yi', 'Yiddish'],
    ['yo', 'Yoruba'],
    ['yue', 'Cantonese'],
    ['zu', 'Zulu'],
    ['wyw', 'Classical Chinese'],
];

var langMap = new Map(supportLanguageList);
var langMapReverse = new Map(supportLanguageList.map(function (item) { return [item[1], item[0]]; }));

function supportLanguages() {
    return supportLanguageList.map(function (item) { return item[0]; });
}

// ============================================================================
// 第二段：配置与工具函数
// ============================================================================

function getOption(key, defaultValue) {
    var val = $option[key];
    if (val === undefined || val === null || val === '') {
        return defaultValue !== undefined ? defaultValue : '';
    }
    return val;
}

function parseJSON(str) {
    if (!str || str.trim() === '' || str.trim() === '{}') return {};
    try {
        return JSON.parse(str);
    } catch (e) {
        $log.error('JSON 解析失败: ' + str);
        return {};
    }
}

function ensureUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    return url.replace(/\/+$/, '');
}

function getApiKey(apiKeys) {
    if (!apiKeys) return '';
    var trimmed = apiKeys.endsWith(',') ? apiKeys.slice(0, -1) : apiKeys;
    var keys = trimmed.split(',').map(function (k) { return k.trim(); }).filter(function (k) { return k; });
    if (keys.length === 0) return '';
    return keys[Math.floor(Math.random() * keys.length)];
}

function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    if (!target || typeof target !== 'object') return source;
    var result = {};
    var key;
    for (key in target) {
        if (target.hasOwnProperty(key)) {
            result[key] = target[key];
        }
    }
    for (key in source) {
        if (source.hasOwnProperty(key)) {
            if (typeof result[key] === 'object' && typeof source[key] === 'object'
                && !Array.isArray(result[key]) && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    return result;
}

function replacePromptVars(prompt, query) {
    if (!prompt) return prompt;
    var sourceLang = langMap.get(query.detectFrom) || query.detectFrom;
    var targetLang = langMap.get(query.detectTo) || query.detectTo;
    return prompt
        .replace(/\$text/g, query.text)
        .replace(/\$sourceLang/g, sourceLang)
        .replace(/\$targetLang/g, targetLang);
}

function buildPrompts(query) {
    var sourceLang = langMap.get(query.detectFrom) || query.detectFrom;
    var targetLang = langMap.get(query.detectTo) || query.detectTo;

    var customSystem = getOption('customSystemPrompt', '');
    var customUser = getOption('customUserPrompt', '');

    var systemPrompt = customSystem
        ? replacePromptVars(customSystem, query)
        : 'You are a translation engine that can only translate text and cannot interpret it.';

    var userPrompt = customUser
        ? replacePromptVars(customUser, query)
        : 'translate from ' + sourceLang + ' to ' + targetLang + ':\n\n' + query.text;

    return { systemPrompt: systemPrompt, userPrompt: userPrompt };
}

function buildUrlWithQuery(baseUrl, queryParams) {
    if (!queryParams || Object.keys(queryParams).length === 0) return baseUrl;
    var parts = [];
    for (var key in queryParams) {
        if (queryParams.hasOwnProperty(key)) {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(queryParams[key]));
        }
    }
    var separator = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    return baseUrl + separator + parts.join('&');
}

function parseNumberOption(key) {
    var val = getOption(key, '');
    if (val === '') return undefined;
    var num = Number(val);
    return isNaN(num) ? undefined : num;
}

// ============================================================================
// 第三段：格式适配器
// ============================================================================

var adapters = {};

// --- OpenAI Chat Completions ---
adapters.openai_chat = {
    defaultPath: '/v1/chat/completions',
    buildUrl: function (base, model, endpoint, extraQuery) {
        var path = endpoint || this.defaultPath;
        var url = ensureUrl(base) + path;
        return buildUrlWithQuery(url, extraQuery);
    },
    buildHeaders: function (apiKey, extraHeaders) {
        var headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        };
        return deepMerge(headers, extraHeaders);
    },
    buildBody: function (query, isStream, extraBody) {
        var prompts = buildPrompts(query);
        var model = getOption('model', 'gpt-4o');
        var body = {
            model: model,
            messages: [
                { role: 'system', content: prompts.systemPrompt },
                { role: 'user', content: prompts.userPrompt }
            ],
            stream: isStream
        };
        var maxTokens = parseNumberOption('maxOutputTokens');
        if (maxTokens !== undefined) body.max_tokens = maxTokens;
        var temperature = parseNumberOption('temperature');
        if (temperature !== undefined) body.temperature = temperature;
        return deepMerge(body, extraBody);
    },
    parseResponse: function (data) {
        if (data && data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content || '';
        }
        return '';
    },
    parseStreamDelta: function (json) {
        if (json.choices && json.choices[0] && json.choices[0].delta) {
            return json.choices[0].delta.content || '';
        }
        return '';
    },
    streamStopMark: '[DONE]'
};

// --- OpenAI Responses API ---
adapters.openai_responses = {
    defaultPath: '/v1/responses',
    buildUrl: function (base, model, endpoint, extraQuery) {
        var path = endpoint || this.defaultPath;
        var url = ensureUrl(base) + path;
        return buildUrlWithQuery(url, extraQuery);
    },
    buildHeaders: function (apiKey, extraHeaders) {
        var headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        };
        return deepMerge(headers, extraHeaders);
    },
    buildBody: function (query, isStream, extraBody) {
        var prompts = buildPrompts(query);
        var model = getOption('model', 'gpt-4o');
        var body = {
            model: model,
            instructions: prompts.systemPrompt,
            input: prompts.userPrompt,
            stream: isStream
        };
        var maxTokens = parseNumberOption('maxOutputTokens');
        if (maxTokens !== undefined) body.max_output_tokens = maxTokens;
        var temperature = parseNumberOption('temperature');
        if (temperature !== undefined) body.temperature = temperature;
        return deepMerge(body, extraBody);
    },
    parseResponse: function (data) {
        // 优先使用 output_text
        if (data && data.output_text) return data.output_text;
        // 回退到 output[].content[].text
        if (data && data.output && Array.isArray(data.output)) {
            var texts = [];
            data.output.forEach(function (item) {
                if (item.content && Array.isArray(item.content)) {
                    item.content.forEach(function (c) {
                        if (c.type === 'output_text' && c.text) texts.push(c.text);
                    });
                }
            });
            return texts.join('');
        }
        return '';
    },
    parseStreamDelta: function (json) {
        // Responses API 流式使用不同的事件结构
        if (json.type === 'response.output_text.delta' && json.delta) {
            return json.delta;
        }
        return '';
    },
    streamStopMark: '[DONE]'
};

// --- OpenAI Legacy Completions ---
adapters.openai_completions = {
    defaultPath: '/v1/completions',
    buildUrl: function (base, model, endpoint, extraQuery) {
        var path = endpoint || this.defaultPath;
        var url = ensureUrl(base) + path;
        return buildUrlWithQuery(url, extraQuery);
    },
    buildHeaders: function (apiKey, extraHeaders) {
        var headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        };
        return deepMerge(headers, extraHeaders);
    },
    buildBody: function (query, isStream, extraBody) {
        var prompts = buildPrompts(query);
        var model = getOption('model', 'gpt-3.5-turbo-instruct');
        var body = {
            model: model,
            prompt: prompts.systemPrompt + '\n\n' + prompts.userPrompt,
            stream: isStream
        };
        var maxTokens = parseNumberOption('maxOutputTokens');
        if (maxTokens !== undefined) body.max_tokens = maxTokens;
        var temperature = parseNumberOption('temperature');
        if (temperature !== undefined) body.temperature = temperature;
        return deepMerge(body, extraBody);
    },
    parseResponse: function (data) {
        if (data && data.choices && data.choices[0]) {
            return data.choices[0].text || '';
        }
        return '';
    },
    parseStreamDelta: function (json) {
        if (json.choices && json.choices[0]) {
            return json.choices[0].text || '';
        }
        return '';
    },
    streamStopMark: '[DONE]'
};

// --- Anthropic Claude Messages ---
adapters.anthropic_messages = {
    defaultPath: '/v1/messages',
    buildUrl: function (base, model, endpoint, extraQuery) {
        var path = endpoint || this.defaultPath;
        var url = ensureUrl(base) + path;
        return buildUrlWithQuery(url, extraQuery);
    },
    buildHeaders: function (apiKey, extraHeaders) {
        var headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };
        return deepMerge(headers, extraHeaders);
    },
    buildBody: function (query, isStream, extraBody) {
        var prompts = buildPrompts(query);
        var model = getOption('model', 'claude-sonnet-4-5');
        var body = {
            model: model,
            system: prompts.systemPrompt,
            messages: [
                { role: 'user', content: prompts.userPrompt }
            ],
            stream: isStream
        };
        // Claude 要求 max_tokens 必填，设默认值
        var maxTokens = parseNumberOption('maxOutputTokens');
        body.max_tokens = maxTokens !== undefined ? maxTokens : 4096;
        var temperature = parseNumberOption('temperature');
        if (temperature !== undefined) body.temperature = temperature;
        return deepMerge(body, extraBody);
    },
    parseResponse: function (data) {
        if (data && data.content && Array.isArray(data.content)) {
            return data.content
                .filter(function (c) { return c.type === 'text'; })
                .map(function (c) { return c.text; })
                .join('');
        }
        return '';
    },
    parseStreamDelta: function (json) {
        // Claude 流式事件结构
        if (json.type === 'content_block_delta' && json.delta && json.delta.type === 'text_delta') {
            return json.delta.text || '';
        }
        return '';
    },
    // Claude 使用 event: message_stop 结束，无 [DONE]
    streamStopMark: null,
    isClaudeStream: true
};

// --- Anthropic OpenAI 兼容 ---
adapters.anthropic_openai_chat = {
    defaultPath: '/v1/chat/completions',
    buildUrl: adapters.openai_chat.buildUrl,
    buildHeaders: function (apiKey, extraHeaders) {
        var headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        };
        return deepMerge(headers, extraHeaders);
    },
    buildBody: adapters.openai_chat.buildBody,
    parseResponse: adapters.openai_chat.parseResponse,
    parseStreamDelta: adapters.openai_chat.parseStreamDelta,
    streamStopMark: '[DONE]'
};

// --- Gemini generateContent ---
adapters.gemini_generate_content = {
    defaultPath: '/v1beta/models/',
    buildUrl: function (base, model, endpoint, extraQuery) {
        var modelName = getOption('model', 'gemini-2.5-flash');
        var apiKey = getApiKey(getOption('apiKey', ''));
        var isStream = getOption('stream', 'enable') === 'enable';
        var action = isStream ? ':streamGenerateContent?alt=sse' : ':generateContent';

        if (endpoint) {
            // 用户自定义路径
            var url = ensureUrl(base) + endpoint;
            var q = deepMerge({ key: apiKey }, extraQuery || {});
            return buildUrlWithQuery(url, q);
        }
        var url = ensureUrl(base) + this.defaultPath + modelName + action;
        var q = deepMerge({ key: apiKey }, extraQuery || {});
        return buildUrlWithQuery(url, q);
    },
    buildHeaders: function (apiKey, extraHeaders) {
        var headers = {
            'Content-Type': 'application/json'
        };
        return deepMerge(headers, extraHeaders);
    },
    buildBody: function (query, isStream, extraBody) {
        var prompts = buildPrompts(query);
        var body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompts.userPrompt }]
                }
            ],
            systemInstruction: {
                parts: [{ text: prompts.systemPrompt }]
            }
        };
        var genConfig = {};
        var maxTokens = parseNumberOption('maxOutputTokens');
        if (maxTokens !== undefined) genConfig.maxOutputTokens = maxTokens;
        var temperature = parseNumberOption('temperature');
        if (temperature !== undefined) genConfig.temperature = temperature;
        if (Object.keys(genConfig).length > 0) {
            body.generationConfig = genConfig;
        }
        return deepMerge(body, extraBody);
    },
    parseResponse: function (data) {
        if (data && data.candidates && data.candidates[0]
            && data.candidates[0].content && data.candidates[0].content.parts) {
            return data.candidates[0].content.parts
                .map(function (p) { return p.text || ''; })
                .join('');
        }
        return '';
    },
    parseStreamDelta: function (json) {
        if (json.candidates && json.candidates[0]
            && json.candidates[0].content && json.candidates[0].content.parts) {
            return json.candidates[0].content.parts
                .map(function (p) { return p.text || ''; })
                .join('');
        }
        return '';
    },
    streamStopMark: null,
    isGeminiStream: true
};

// --- Gemini OpenAI 兼容 ---
adapters.gemini_openai_chat = {
    defaultPath: '/v1beta/openai/chat/completions',
    buildUrl: adapters.openai_chat.buildUrl,
    buildHeaders: function (apiKey, extraHeaders) {
        var headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        };
        return deepMerge(headers, extraHeaders);
    },
    buildBody: adapters.openai_chat.buildBody,
    parseResponse: adapters.openai_chat.parseResponse,
    parseStreamDelta: adapters.openai_chat.parseStreamDelta,
    streamStopMark: '[DONE]'
};

function getAdapter(format) {
    var adapter = adapters[format];
    if (!adapter) {
        $log.error('未知的请求格式: ' + format);
        return adapters.openai_chat; // fallback
    }
    return adapter;
}

// ============================================================================
// 第四段：请求引擎
// ============================================================================

function parseSSELine(line) {
    if (!line || line.startsWith(':')) return null; // 注释或空行
    if (line.startsWith('data: ')) {
        return line.substring(6);
    }
    if (line.startsWith('data:')) {
        return line.substring(5);
    }
    return null;
}

function makeNonStreamRequest(query, adapter) {
    var format = getOption('format', 'openai_chat');
    var apiKey = getApiKey(getOption('apiKey', ''));
    var base = getOption('baseURL', '');
    var endpoint = getOption('endpointOverride', '');
    var extraHeaders = parseJSON(getOption('extraHeaders', ''));
    var extraQuery = parseJSON(getOption('extraQuery', ''));
    var extraBody = parseJSON(getOption('extraBody', ''));
    var model = getOption('model', '');

    var url = adapter.buildUrl(base, model, endpoint, extraQuery);
    var headers = adapter.buildHeaders(apiKey, extraHeaders);
    var body = adapter.buildBody(query, false, extraBody);

    $log.info('请求 URL: ' + url);
    $log.info('请求体: ' + JSON.stringify(body));

    $http.request({
        method: 'POST',
        url: url,
        header: headers,
        body: body,
        handler: function (resp) {
            if (resp.error || !resp.data) {
                handleError(query, {
                    type: 'api',
                    message: '网络请求失败',
                    addition: resp.error ? JSON.stringify(resp.error) : '无响应数据'
                });
                return;
            }
            if (resp.response && resp.response.statusCode >= 400) {
                handleError(query, {
                    type: 'api',
                    message: 'API 错误 (' + resp.response.statusCode + ')',
                    addition: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data)
                });
                return;
            }
            var text = adapter.parseResponse(resp.data);
            if (!text) {
                handleError(query, {
                    type: 'api',
                    message: '无法解析 API 响应',
                    addition: JSON.stringify(resp.data).substring(0, 500)
                });
                return;
            }
            query.onCompletion({
                result: {
                    from: query.detectFrom,
                    to: query.detectTo,
                    toParagraphs: text.split(/\n+/)
                }
            });
        }
    });
}

function makeStreamRequest(query, adapter) {
    var format = getOption('format', 'openai_chat');
    var apiKey = getApiKey(getOption('apiKey', ''));
    var base = getOption('baseURL', '');
    var endpoint = getOption('endpointOverride', '');
    var extraHeaders = parseJSON(getOption('extraHeaders', ''));
    var extraQuery = parseJSON(getOption('extraQuery', ''));
    var extraBody = parseJSON(getOption('extraBody', ''));
    var model = getOption('model', '');

    var url = adapter.buildUrl(base, model, endpoint, extraQuery);
    var headers = adapter.buildHeaders(apiKey, extraHeaders);
    var body = adapter.buildBody(query, true, extraBody);

    $log.info('[Stream] 请求 URL: ' + url);

    var targetText = '';
    var hasError = false;

    $http.streamRequest({
        method: 'POST',
        url: url,
        header: headers,
        body: body,
        cancelSignal: query.cancelSignal,
        streamHandler: function (streamData) {
            if (hasError) return;

            var text = streamData.text;
            if (!text) return;

            // 按行解析 SSE
            var lines = text.split('\n');
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;

                // Claude 特殊处理：event 行
                if (line.startsWith('event:')) {
                    var eventType = line.substring(6).trim();
                    if (eventType === 'message_stop' || eventType === 'error') {
                        continue;
                    }
                    continue;
                }

                var dataStr = parseSSELine(line);
                if (dataStr === null) continue;

                // 检查停止标记
                if (adapter.streamStopMark && dataStr.trim() === adapter.streamStopMark) {
                    continue;
                }

                try {
                    var json = JSON.parse(dataStr);
                    var delta = adapter.parseStreamDelta(json);
                    if (delta) {
                        targetText += delta;
                        query.onStream({
                            result: {
                                from: query.detectFrom,
                                to: query.detectTo,
                                toParagraphs: [targetText]
                            }
                        });
                    }
                } catch (e) {
                    // 非 JSON 行，忽略
                }
            }
        },
        handler: function (resp) {
            if (hasError) return;

            if (resp.error) {
                handleError(query, {
                    type: 'api',
                    message: '流式请求失败',
                    addition: JSON.stringify(resp.error)
                });
                return;
            }
            if (resp.response && resp.response.statusCode >= 400) {
                handleError(query, {
                    type: 'api',
                    message: 'API 错误 (' + resp.response.statusCode + ')',
                    addition: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data)
                });
                return;
            }

            // 流结束，发送最终结果
            if (targetText) {
                query.onCompletion({
                    result: {
                        from: query.detectFrom,
                        to: query.detectTo,
                        toParagraphs: [targetText]
                    }
                });
            } else {
                // 流式没有拿到数据，尝试从完整响应解析
                if (resp.data) {
                    var fullData = typeof resp.data === 'string' ? (function () { try { return JSON.parse(resp.data); } catch (e) { return null; } })() : resp.data;
                    if (fullData) {
                        var text = adapter.parseResponse(fullData);
                        if (text) {
                            query.onCompletion({
                                result: {
                                    from: query.detectFrom,
                                    to: query.detectTo,
                                    toParagraphs: text.split(/\n+/)
                                }
                            });
                            return;
                        }
                    }
                }
                handleError(query, {
                    type: 'api',
                    message: '流式响应为空',
                    addition: '未收到任何翻译结果'
                });
            }
        }
    });
}

// ============================================================================
// 第五段：主入口
// ============================================================================

function translate(query, completion) {
    // 验证配置
    var apiKey = getOption('apiKey', '');
    var baseURL = getOption('baseURL', '');
    var model = getOption('model', '');
    var format = getOption('format', 'openai_chat');

    if (!apiKey && format !== 'gemini_generate_content') {
        handleError(query, {
            type: 'secretKey',
            message: '请填写 API Key',
            addition: '请在插件配置中填写有效的 API Key'
        });
        return;
    }

    if (!baseURL) {
        handleError(query, {
            type: 'param',
            message: '请填写 Base URL',
            addition: '请在插件配置中填写 API 服务的基础地址'
        });
        return;
    }

    if (!model && format !== 'gemini_generate_content') {
        handleError(query, {
            type: 'param',
            message: '请填写模型名称',
            addition: '请在插件配置中填写要使用的模型名称'
        });
        return;
    }

    var adapter = getAdapter(format);
    var isStream = getOption('stream', 'enable') === 'enable';

    if (isStream) {
        makeStreamRequest(query, adapter);
    } else {
        makeNonStreamRequest(query, adapter);
    }
}

function pluginValidate(completion) {
    var apiKey = getOption('apiKey', '');
    var baseURL = getOption('baseURL', '');
    var format = getOption('format', 'openai_chat');

    if (!apiKey) {
        completion({
            result: false,
            error: { type: 'secretKey', message: '请填写 API Key' }
        });
        return;
    }
    if (!baseURL) {
        completion({
            result: false,
            error: { type: 'param', message: '请填写 Base URL' }
        });
        return;
    }

    // 使用简单的翻译请求测试连通性
    var testQuery = {
        text: 'hello',
        detectFrom: 'en',
        detectTo: 'zh-Hans',
        onCompletion: function (result) {
            if (result.error) {
                completion({ result: false, error: result.error });
            } else {
                completion({ result: true });
            }
        },
        onStream: function () {},
        cancelSignal: undefined
    };

    var adapter = getAdapter(format);
    makeNonStreamRequest(testQuery, adapter);
}

function pluginTimeoutInterval() {
    return 120;
}

// ============================================================================
// 第六段：错误处理
// ============================================================================

function handleError(query, error) {
    var serviceError = {
        type: error.type || 'unknown',
        message: error.message || '未知错误',
        addition: error.addition || ''
    };
    $log.error('翻译错误: ' + JSON.stringify(serviceError));
    query.onCompletion({ error: serviceError });
}
