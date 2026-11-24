(() => {
  const names = {
    none: '关闭思考', minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '很高', max: '最高'
  };
  const docs = {
    openai: 'https://developers.openai.com/api/docs/guides/deployment-checklist',
    anthropic: 'https://platform.claude.com/docs/en/build-with-claude/thinking',
    deepseek: 'https://api-docs.deepseek.com/guides/thinking_mode/',
    glm: 'https://docs.bigmodel.cn/cn/guide/capabilities/thinking',
    qwen: 'https://help.aliyun.com/zh/model-studio/deep-thinking',
    groq: 'https://console.groq.com/docs/reasoning',
    grok: 'https://docs.x.ai/developers/model-capabilities/text/reasoning',
    kimi: 'https://platform.moonshot.cn/docs/guide/kimi-k3-1-pro-quickstart',
    gemini: 'https://aistudio.google.com/docs/thinking?generate-content=true',
    openrouter: 'https://openrouter.ai/docs/guides/best-practices/reasoning-tokens',
    bilibili: 'https://github.com/bilibili/Index-Translate/blob/main/inference/llm/call_api.py'
  };

  function efforts(levels, buildBody) {
    return Object.keys(names).filter(level => levels?.includes(level)).map(level => ({
      value: level === 'none' ? 'off' : level,
      label: names[level],
      body: buildBody(level)
    }));
  }

  function toggle(enabled, body) {
    return {value: enabled ? 'on' : 'off', label: enabled ? '开启思考' : '关闭思考', body};
  }

  // Bob concatenates Base URL and endpoint. Check the resulting address before suggesting provider parameters.
  function resolveAddress(baseURL, format, endpoint, model) {
    const paths = {
      openai_chat: '/v1/chat/completions', openai_responses: '/v1/responses',
      anthropic_messages: '/v1/messages', gemini_generate_content: '/v1beta/models/' + model + ':generateContent'
    };
    if (!baseURL || !paths[format]) return null;
    try {
      const base = baseURL.trim().replace(/\/+$/, '');
      const url = new URL((/^https?:\/\//i.test(base) ? base : 'https://' + base) + (endpoint || paths[format]));
      if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return null;
      if (url.search && !(format === 'gemini_generate_content' && url.search === '?alt=sse')) return null;
      return url;
    } catch {
      return null;
    }
  }

  window.reasoningFor = function ({provider, model = '', baseURL = '', format, endpoint = '', sourceModel} = {}) {
    const id = typeof provider === 'string' ? provider : provider?.id;
    const url = docs[id] || '';
    const result = (choices, note) => ({choices, note, url});
    const unavailable = () => result([], '当前模型和接口尚无已核实的思考选项。');
    const name = model.trim();
    if (!name) return result([], '填写模型 ID 后，可查看已核实的思考选项。');
    const target = resolveAddress(baseURL, format, endpoint.trim(), name);
    if (!target) return unavailable();
    const is = (host, path, kind) => target.hostname === host && target.pathname === path && format === kind;
    const row = sourceModel?.id === name ? sourceModel : null;

    if (id === 'openai') {
      const chat = is('api.openai.com', '/v1/chat/completions', 'openai_chat');
      const responses = is('api.openai.com', '/v1/responses', 'openai_responses');
      if (!(chat || responses) || !row?.reasoningFormats?.includes(format) || !row.reasoningEfforts?.length) return unavailable();
      return result(efforts(row.reasoningEfforts, level => chat ? {reasoning_effort: level} : {reasoning: {effort: level}}),
        row.reasoningEfforts.includes('none') ? '这个型号支持关闭思考。想保留推理时，可以选低强度。' : '这个型号需要思考，日常翻译可以先试低强度。');
    }
    if (id === 'openrouter' && is('openrouter.ai', '/api/v1/chat/completions', 'openai_chat')) {
      if (!row?.reasoningEfforts?.length) return result([], 'OpenRouter 没有为这个模型列出可选强度。');
      return result(efforts(row.reasoningEfforts, level => ({reasoning: {effort: level}})),
        '这些档位来自 OpenRouter 对当前模型的接口说明。');
    }
    if (id === 'groq' && is('api.groq.com', '/openai/v1/chat/completions', 'openai_chat')
        && ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'].includes(name)) {
      return result(efforts(['low', 'medium', 'high'], level => ({reasoning_effort: level})),
        '这两个 GPT-OSS 型号的最低强度为 low，仍会使用少量思考 token。');
    }
    if (id === 'grok' && is('api.x.ai', '/v1/chat/completions', 'openai_chat')
        && ['grok-4.5', 'grok-4.6', 'grok-4.7'].includes(name)) {
      const levels = name === 'grok-4.5' ? ['low', 'medium', 'high'] : ['low', 'medium', 'high', 'xhigh'];
      return result(efforts(levels, level => ({reasoning_effort: level})), '这些型号始终启用思考，可以调低强度。');
    }
    if (id === 'kimi' && is('api.moonshot.cn', '/v1/chat/completions', 'openai_chat') && name === 'kimi-k3.1-pro') {
      return result(efforts(['low', 'high', 'max'], level => ({reasoning_effort: level})), 'K3.1 Pro 始终开启思考，默认强度为 max。');
    }
    if (id === 'gemini' && format === 'gemini_generate_content' && target.hostname === 'generativelanguage.googleapis.com') {
      const prefix = '/v1beta/models/' + name;
      if (![prefix + ':generateContent', prefix + ':streamGenerateContent'].includes(target.pathname)) return unavailable();
      if (name === 'gemini-2.5-flash-lite' && row?.thinkingBudget) {
        const budget = row.thinkingBudget;
        const choice = (value, label, tokens) => ({value, label, body: {generationConfig: {thinkingConfig: {thinkingBudget: tokens}}}});
        return result([choice('off', '关闭思考', budget.off), choice('low', '最低预算', budget.min),
          choice('dynamic', '动态预算', budget.dynamic)],
          'Google 仅向此前使用过 2.5 系列的用户提供此型号。默认关闭思考，固定预算可设为 ' + budget.min + '–' + budget.max + ' token。');
      }
      if (!row?.thinkingLevels?.length) return unavailable();
      return result(efforts(row.thinkingLevels, level => ({generationConfig: {thinkingConfig: {thinkingLevel: level}}})),
        '这些档位调节模型的思考深度，最低档也可能产生思考 token。');
    }
    if (id === 'deepseek' && ['deepseek-flash', 'deepseek-v4-pro'].includes(name)) {
      const levels = ['none', 'low', 'high', 'max'];
      if (is('api.deepseek.com', '/chat/completions', 'openai_chat')) {
        return result(efforts(levels, level => level === 'none' ? {thinking: {type: 'disabled'}} :
          {thinking: {type: 'enabled'}, reasoning_effort: level}), '关闭后直接翻译，其他档位会显式开启思考。');
      }
      if (is('api.deepseek.com', '/responses', 'openai_responses')) {
        return result(efforts(levels, level => ({reasoning: {effort: level}})), 'Responses 使用 reasoning.effort 选择思考模式。');
      }
      if (is('api.deepseek.com', '/anthropic/v1/messages', 'anthropic_messages')) {
        return result(efforts(levels, level => level === 'none' ? {thinking: {type: 'disabled'}} :
          {thinking: {type: 'enabled'}, output_config: {effort: level}}), '此处使用 DeepSeek 的 Anthropic 兼容接口。');
      }
    }
    if (id === 'glm' && is('open.bigmodel.cn', '/api/paas/v4/chat/completions', 'openai_chat')) {
      if (['glm-5.3', 'glm-5.3-flash', 'glm-5.3-flashx'].includes(name)) {
        return result(efforts(['low', 'high', 'max'], level => ({reasoning_effort: level})), '该型号始终开启思考，可将强度调至 low。');
      }
      if (name === 'glm-5.2') {
        return result(efforts(['none', 'high', 'max'], level => level === 'none' ? {thinking: {type: 'disabled'}} :
          {thinking: {type: 'enabled'}, reasoning_effort: level}), 'high 和 max 是该型号实际区分的两个思考强度。');
      }
      if (['glm-5.1', 'glm-5', 'glm-4.7', 'glm-4.6'].includes(name)) {
        return result([toggle(false, {thinking: {type: 'disabled'}}), toggle(true, {thinking: {type: 'enabled'}})],
          '选择开启后，部分型号会根据任务决定是否思考。');
      }
    }
    if (id === 'qwen' && format === 'openai_chat' && target.pathname === '/compatible-mode/v1/chat/completions') {
      const host = target.hostname;
      const publicHost = ['dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com', 'dashscope-us.aliyuncs.com'].includes(host);
      const workspace = /^(?:[a-z0-9-]+|\{workspaceid\})\.(?:cn-beijing|ap-southeast-1|us-east-1|ap-northeast-1)\.maas\.aliyuncs\.com$/.test(host);
      if (!(publicHost || workspace) || !['qwen-plus', 'qwen-plus-latest', 'qwen-plus-2025-12-01', 'qwen-plus-2025-04-28', 'qwen-flash', 'qwen-flash-2025-07-28'].includes(name)) return unavailable();
      return result([toggle(false, {enable_thinking: false}), toggle(true, {enable_thinking: true})],
        '这些混合思考型号可切换模式。官方默认关闭时，额外请求体也可以留空。');
    }
    if (id === 'bilibili' && is('index-translate.bilibili.com', '/v1/chat/completions', 'openai_chat')
        && ['Index-Translate-2B', 'Index-Translate-9B', 'Index-Translate-35B-A3B'].includes(name)) {
      return result([toggle(false, {chat_template_kwargs: {enable_thinking: false}})],
        '官方翻译客户端使用此设置让模型直接给出译文。');
    }
    if (id === 'anthropic' && is('api.anthropic.com', '/v1/messages', 'anthropic_messages')
        && ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-2'].includes(name)) {
      const choices = efforts(['low', 'medium', 'high', 'xhigh', 'max'], level => ({output_config: {effort: level}}));
      if (name === 'claude-haiku-5-5') {
        choices.unshift(toggle(false, {thinking: {type: 'disabled'}, output_config: {effort: 'low'}}));
        return result(choices, '关闭会同时使用 low，符合 Haiku 对关闭思考时强度的限制。');
      }
      if (name === 'claude-sonnet-5-5') {
        choices.unshift({value: 'between_tools', label: '仅工具间思考',
          body: {thinking: {type: 'between_tools'}, output_config: {effort: 'low'}}});
        return result(choices, '仅工具间思考会跳过答复前的思考。插件翻译时通常不调用工具，此时只会返回文本。');
      }
      return result(choices, '该型号无法完全关闭思考，可通过 effort 调低强度。');
    }
    return unavailable();
  };
})();
