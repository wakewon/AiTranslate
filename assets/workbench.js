(() => {
  const byId = (id) => document.getElementById(id);
  const providerSelect = byId('provider');
  const modelInput = byId('model');
  const formatSelect = byId('format');
  const authSelect = byId('auth-mode');
  const tabLinks = [...document.querySelectorAll('[role="tab"]')];
  const custom = {
    id: 'custom', name: '自定义服务商', status: 'supported', models: [],
    format: 'openai_chat', authMode: 'auto', baseURL: '', endpointOverride: '',
    modelHint: '使用服务商控制台或本地服务器列出的完整模型 ID。'
  };
  let providers = [];
  let sources = {};
  let selected = custom;
  let thinkingModel = '';
  let toastTimer;

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function selectLabel(select) {
    return select.selectedOptions[0]?.textContent || '';
  }

  function setTab(hash, writeURL = false) {
    const target = hash === 'thinking' ? 'lookup' : hash;
    const active = tabLinks.find(link => link.getAttribute('aria-controls') === target && !link.hidden) || tabLinks[0];
    for (const link of tabLinks) {
      const current = link === active;
      link.setAttribute('aria-selected', String(current));
      link.tabIndex = current ? 0 : -1;
      byId(link.getAttribute('aria-controls')).hidden = !current;
    }
    if (active.id === 'tab-lookup') {
      byId('lookup-kind').value = hash === 'thinking' ? 'thinking' : 'connection';
      renderPrompts();
    }
    if (writeURL) {
      const url = new URL(location.href);
      url.hash = hash === 'thinking' ? 'thinking' : active.getAttribute('aria-controls');
      replaceLocation(url);
    }
  }

  function replaceLocation(url) {
    try { history.replaceState(null, '', url); } catch { /* Local previews can restrict history updates. */ }
  }

  for (const link of tabLinks) {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      setTab(link.getAttribute('aria-controls'), true);
    });
    link.addEventListener('keydown', event => {
      const links = tabLinks.filter(item => !item.hidden);
      const index = links.indexOf(link);
      const next = {ArrowLeft: (index + links.length - 1) % links.length, ArrowRight: (index + 1) % links.length, Home: 0, End: links.length - 1}[event.key];
      if (next === undefined) return;
      event.preventDefault();
      links[next].focus();
      links[next].click();
    });
  }
  window.addEventListener('hashchange', () => setTab(location.hash.slice(1)));
  byId('lookup-kind').addEventListener('change', () => setTab(byId('lookup-kind').value === 'thinking' ? 'thinking' : 'lookup', true));

  function field(label, value, id, placeholder = '留空', copyable = true) {
    const group = el('div');
    const content = el('dd', value || placeholder, value ? '' : 'bench-placeholder');
    content.id = id;
    group.append(el('dt', label), content);
    if (value && copyable) {
      const action = el('dd', undefined, 'bench-field-action');
      const button = el('button', '复制');
      button.type = 'button';
      button.dataset.copy = id;
      button.setAttribute('aria-label', '复制' + label);
      action.append(button);
      group.append(action);
    }
    return group;
  }

  function renderFields() {
    const unavailable = selected.status !== 'supported';
    const list = byId('field-list');
    list.hidden = unavailable;
    byId('compatibility-note').hidden = !unavailable;
    byId('compatibility-note').textContent = unavailable ? '此服务暂无可直接使用的插件配置。可前往官方文档，或用「查询提示词」核对最新的接入方式。' : '';
    byId('credential-note').hidden = unavailable;
    if (unavailable) return;
    const baseURL = byId('base-url').value.trim();
    const token = baseURL.match(/\{[^}]+\}/)?.[0];
    list.replaceChildren(
      field('请求格式', selectLabel(formatSelect), 'out-format'),
      field('Base URL', baseURL, 'out-base', '请在连接字段中填写服务地址', !token),
      field('端点路径覆盖', byId('endpoint').value.trim(), 'out-endpoint', '留空，使用此格式的默认路径'),
      field('鉴权方式', selectLabel(authSelect), 'out-auth'),
      field('模型', modelInput.value.trim(), 'out-model', '填写账号或部署中可用的模型 ID')
    );
    const keyHint = authSelect.value === 'none'
      ? 'API Key 一栏可留空。如果服务启用了鉴权，请依照端点文档在 Bob 中设置凭据。'
      : '在 Bob 的「API Key」中填写服务商提供的密钥或令牌。在此页面无需输入密钥。';
    byId('credential-note').textContent = (token ? '先在「编辑连接字段」中将 ' + token + ' 换成你的实际取值，再复制 Base URL。' : '') + keyHint;
  }

  function renderModelDetails() {
    const source = sources[selected.id];
    const model = source?.models.find(item => item.id === modelInput.value.trim());
    const endpoint = byId('endpoint').value.trim().split('?')[0];
    const pathModel = endpoint.match(/\/models\/([^/]+):(?:streamGenerateContent|generateContent)$/)?.[1];
    const levels = selected.id === 'gemini' && formatSelect.value === 'gemini_generate_content' && (!endpoint || pathModel === model?.id)
      ? model?.thinkingLevels || [] : [];
    const current = levels.length ? model.id : '';
    if (thinkingModel !== current) {
      thinkingModel = current;
      byId('thinking-level').replaceChildren(new Option('使用模型默认值', ''), ...levels.map(level => new Option(level, level)));
      renderJSON();
    }
    byId('thinking-field').hidden = !levels.length;
    byId('edit-thinking').hidden = !levels.length;
    byId('model-details').hidden = !model;
    if (!model) return;
    const details = byId('model-data');
    details.replaceChildren();
    for (const [label, value] of [['上下文长度', model.contextLength], ['最大输出', model.maxOutputTokens]]) {
      if (value != null) details.append(el('dt', label), el('dd', value.toLocaleString('zh-CN') + ' tokens'));
    }
    if (levels.length) details.append(el('dt', '思考等级'), el('dd', levels.join(' · ')));
    details.append(el('dt', '接口列出的参数'), el('dd', model.parameters?.length ? model.parameters.join(' · ') : '该来源未列出参数'));
    byId('model-source').href = source.url;
  }

  function renderPrompts() {
    const scene = byId('scene').value;
    const style = {
      general: '用自然、准确的表达传达原意，保留原文的语气和段落。',
      technical: '保持技术术语前后一致，保留代码、命令、路径、占位符和 Markdown 结构。',
      mail: '保留称呼、署名、日期和行动事项，使用清楚、得体的邮件措辞。'
    }[scene];
    byId('system-output').textContent = '你是一名译者。' + style + '只输出译文。';
    if (selected.id === 'bilibili') {
      byId('user-output').textContent = '请将以下文本翻译为 $targetLang，直接输出译文。\n\n$text';
    } else if (formatSelect.value === 'anthropic_messages') {
      byId('user-output').textContent = '将 <source> 中的原文从 $sourceLang 翻译成 $targetLang。\n\n<source>\n$text\n</source>';
    } else {
      byId('user-output').textContent = '请将以下原文从 $sourceLang 翻译成 $targetLang。\n\n$text';
    }
    const name = selected === custom ? byId('custom-name').value.trim() || '自定义服务商（名称待补充）' : selected.name;
    const context = ['我想在 Bob 的 AiTranslate 插件中使用' + name + '。'];
    if (modelInput.value.trim()) context.push('模型或部署名：' + modelInput.value.trim());
    if (selected.status === 'supported') {
      context.push('拟用请求格式：' + selectLabel(formatSelect));
      if (byId('base-url').value.trim()) context.push('Base URL：' + byId('base-url').value.trim());
      if (byId('endpoint').value.trim()) context.push('端点路径覆盖：' + byId('endpoint').value.trim());
    }
    if (selected.docs) context.push('官方资料：' + selected.docs);
    if (byId('lookup-kind').value === 'thinking') {
      context.push('', '请查阅该服务商的官方 API 文档，核对这个模型在指定端点能否关闭思考。若只能降低推理强度，请列出可用档位及最低档。若官方未说明，请注明。');
      context.push('按实际 HTTP 请求体给出可以粘贴到「额外请求体」的 JSON 对象，省去 SDK 的 extra_body 包装层。区分 Chat Completions、Responses 和服务商原生接口的字段层级，附上对应模型和端点的官方文档链接。');
    } else {
      context.push('', '请核对官方 HTTP API 文档，列出可直接填写到插件的请求格式、Base URL、端点路径覆盖、模型、鉴权方式和 API Key 的填写规则。说明账户、地区或部署方式会影响哪些字段，附上官方来源。');
      context.push('插件支持 OpenAI Chat Completions（默认 /v1/chat/completions）、Responses（/v1/responses）、Legacy Completions（/v1/completions）、Anthropic Messages（/v1/messages）、Anthropic OpenAI 兼容（/v1/chat/completions）、Gemini generateContent（按模型与流式开关拼接）和 Gemini OpenAI 兼容（/v1beta/openai/chat/completions）。请判断哪种格式可用。');
      context.push('当默认路径与实际接口一致时，端点路径覆盖留空。其余情况给出以 / 开头的路径及最终请求地址。Azure 使用部署名，自托管使用服务器提供的模型 ID。插件的自动鉴权对 Gemini 原生使用 x-goog-api-key，对其余格式使用 Bearer，也可选 x-api-key、api-key、URL 查询参数 key 或手动鉴权。必要时分别给出额外请求头与查询参数的 JSON，密钥用占位符。');
    }
    byId('lookup-output').textContent = context.join('\n');
  }

  function selectProvider(id) {
    selected = providers.find(item => item.id === id) || custom;
    providerSelect.value = selected.id;
    byId('custom-field').hidden = selected !== custom;
    byId('provider-note').textContent = selected.note || '';
    byId('provider-note-wrap').hidden = !selected.note && !selected.docs;
    byId('provider-docs').hidden = !selected.docs;
    if (selected.docs) byId('provider-docs').href = selected.docs;
    const available = selected.status === 'supported';
    byId('editable-connection').hidden = !available;
    byId('tab-prompts').hidden = !available;
    byId('tab-parameters').hidden = !available;
    byId('base-url').value = selected.baseURL || '';
    byId('endpoint').value = selected.endpointOverride || '';
    formatSelect.value = selected.format || custom.format;
    authSelect.value = selected.authMode || custom.authMode;
    const source = sources[selected.id];
    const models = source?.models.map(item => item.id) || selected.models || [];
    byId('model-choices').replaceChildren(...models.map(id => new Option(id, id)));
    modelInput.value = (selected.models || []).find(id => models.includes(id)) || '';
    byId('model-hint').textContent = selected.modelHint || '';
    byId('snapshot-hint').textContent = source?.models.length
      ? '目录收录 ' + source.models.length + ' 个模型，可在输入框中检索。' + (source.updatedAt ? '最近变更于 ' + source.updatedAt + '。' : '')
      : '';
    byId('bilibili-template').hidden = selected.id !== 'bilibili';
    byId('connection-options').open = selected === custom || /[{}<>]/.test(selected.baseURL || '');
    byId('model-details').open = false;
    restoreRows();
    renderFields();
    renderModelDetails();
    renderPrompts();
    setTab(location.hash.slice(1));
  }

  providerSelect.addEventListener('change', () => {
    rememberRows();
    const url = new URL(location.href);
    url.searchParams.set('provider', providerSelect.value);
    replaceLocation(url);
    selectProvider(providerSelect.value);
  });
  for (const id of ['model', 'custom-name', 'format', 'auth-mode', 'base-url', 'endpoint', 'scene']) {
    byId(id).addEventListener('input', () => {
      renderFields();
      renderModelDetails();
      renderPrompts();
    });
  }

  const typeLabels = {string: '字符串', number: '数字', boolean: '布尔值', null: 'null', object: '对象', array: '数组'};
  const templates = {
    reasoning_effort: ['none', 'string'],
    reasoning: ['{"effort":"none"}', 'object'],
    thinking: ['{"type":"disabled"}', 'object'],
    enable_thinking: ['false', 'boolean'],
    chat_template_kwargs: ['{"enable_thinking":false}', 'object'],
    top_p: ['0.9', 'number'],
    top_k: ['40', 'number'],
    response_format: ['{"type":"text"}', 'object']
  };
  const rowList = byId('param-rows');
  const drafts = new Map();
  byId('edit-thinking').addEventListener('click', () => {
    setTab('parameters', true);
    byId('thinking-level').focus();
  });
  byId('thinking-level').addEventListener('change', renderJSON);

  function paramInputs(row) {
    return ['key', 'value', 'type'].map(role => row.querySelector('[data-role="' + role + '"]'));
  }

  function rememberRows() {
    drafts.set(selected.id, [...rowList.children].map(row => paramInputs(row).map(input => input.value)));
  }

  function restoreRows() {
    rowList.replaceChildren();
    for (const values of drafts.get(selected.id) || []) addRow(...values);
    byId('template').value = '';
    byId('add-template').disabled = true;
    renderJSON();
  }

  function addRow(key = '', value = '', type = 'string') {
    const row = el('div', undefined, 'bench-param-row');
    const keyInput = el('input');
    const valueInput = el('input');
    const typeSelect = el('select');
    for (const [element, role, label] of [[keyInput, 'key', '参数名'], [valueInput, 'value', '参数值'], [typeSelect, 'type', '值类型']]) {
      element.dataset.role = role;
      element.setAttribute('aria-label', label);
      if (element.tagName === 'INPUT') {
        element.placeholder = label;
        element.spellcheck = false;
        element.autocomplete = 'off';
      }
    }
    typeSelect.append(...Object.entries(typeLabels).map(([id, name]) => new Option(name, id)));
    keyInput.value = key;
    valueInput.value = value;
    typeSelect.value = type;
    valueInput.disabled = type === 'null';
    typeSelect.addEventListener('change', () => {
      valueInput.disabled = typeSelect.value === 'null';
      if (valueInput.disabled) valueInput.value = 'null';
      if (typeSelect.value === 'boolean' && !['true', 'false'].includes(valueInput.value)) valueInput.value = 'true';
      renderJSON();
    });
    const remove = el('button', '移除');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      renderJSON();
      (next?.firstElementChild || byId('add-row')).focus();
    });
    row.append(keyInput, valueInput, typeSelect, remove);
    rowList.append(row);
    return keyInput;
  }

  function readValue(type, raw) {
    if (type === 'string') return raw;
    if (type === 'null') return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch {}
    const valid = {
      number: Number.isFinite(parsed),
      boolean: typeof parsed === 'boolean',
      object: parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
      array: Array.isArray(parsed)
    }[type];
    if (!valid) throw new Error('请输入有效的' + typeLabels[type] + '。');
    return parsed;
  }

  function applyThinkingLevel(output, level) {
    const config = output.generationConfig === undefined ? {} : output.generationConfig;
    if (!config || typeof config !== 'object' || Array.isArray(config)) return '设置思考等级时，generationConfig 需要是 JSON 对象。';
    const thinking = config.thinkingConfig === undefined ? {} : config.thinkingConfig;
    if (!thinking || typeof thinking !== 'object' || Array.isArray(thinking)) return '设置思考等级时，thinkingConfig 需要是 JSON 对象。';
    if ('thinkingBudget' in thinking || ('thinkingLevel' in thinking && thinking.thinkingLevel !== level)) {
      return '手填参数中已有其他思考设置。请保留其中一种，或将上方思考等级切回「使用模型默认值」。';
    }
    output.generationConfig = { ...config, thinkingConfig: { ...thinking, thinkingLevel: level } };
  }

  function renderJSON() {
    const output = Object.create(null);
    const messages = [];
    [...rowList.children].forEach((row, index) => {
      const [keyInput, valueInput, typeSelect] = paramInputs(row);
      const key = keyInput.value.trim();
      keyInput.removeAttribute('aria-invalid');
      valueInput.removeAttribute('aria-invalid');
      if (!key || Object.prototype.hasOwnProperty.call(output, key)) {
        messages.push('第 ' + (index + 1) + ' 项' + (key ? '的参数名重复。' : '需要填写参数名。'));
        keyInput.setAttribute('aria-invalid', 'true');
        return;
      }
      try {
        output[key] = readValue(typeSelect.value, valueInput.value);
      } catch (error) {
        messages.push('第 ' + (index + 1) + ' 项：' + error.message);
        valueInput.setAttribute('aria-invalid', 'true');
      }
    });
    const level = byId('thinking-level').value;
    if (!messages.length && level) {
      const error = applyThinkingLevel(output, level);
      if (error) messages.push(error);
    }
    byId('json-output').textContent = messages.length ? '请先修正下面标出的参数。' : JSON.stringify(output, null, 2);
    byId('param-error').textContent = messages.join(' ');
    document.querySelector('[data-copy="json-output"]').disabled = Boolean(messages.length);
  }

  rowList.addEventListener('input', renderJSON);
  byId('add-row').addEventListener('click', () => { addRow().focus(); renderJSON(); });
  byId('template').addEventListener('change', () => { byId('add-template').disabled = !byId('template').value; });
  byId('add-template').addEventListener('click', () => {
    const key = byId('template').value;
    const existing = [...rowList.children].find(row => paramInputs(row)[0].value.trim() === key);
    if (existing) {
      paramInputs(existing)[1].focus();
      notify('已添加这个参数，可直接修改参数值。');
    } else if (templates[key]) {
      addRow(key, ...templates[key]);
      renderJSON();
      notify('已添加 ' + key);
    }
  });

  function notify(message) {
    clearTimeout(toastTimer);
    byId('copy-status').textContent = message;
    toastTimer = setTimeout(() => { byId('copy-status').textContent = ''; }, 3000);
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('button[data-copy]');
    if (!button) return;
    const node = byId(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(node.textContent);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      if (!copied) { notify('已选中文本，请使用系统复制命令。'); return; }
      selection.removeAllRanges();
    }
    notify('已复制');
  });

  async function loadJSON(file) {
    const response = await fetch('../data/' + file);
    if (!response.ok) throw new Error('读取目录失败');
    return response.json();
  }

  async function start() {
    let catalog;
    let snapshot;
    if (window.AiTranslateData) {
      catalog = window.AiTranslateData.providers;
      snapshot = window.AiTranslateData.modelCatalog;
    } else {
      const loaded = await Promise.allSettled([loadJSON('providers.json'), loadJSON('model-catalog.json')]);
      catalog = loaded[0].value;
      snapshot = loaded[1].value;
    }
    providers = Array.isArray(catalog?.providers) ? catalog.providers : [];
    sources = snapshot?.sources || {};
    const groups = {cloud: '云服务', gateway: '聚合平台', local: '本地部署', other: '其他服务'};
    for (const [id, label] of Object.entries(groups)) {
      const entries = providers.filter(entry => entry.group === id);
      if (!entries.length) continue;
      const group = el('optgroup');
      group.label = label;
      group.append(...entries.map(entry => new Option(entry.name, entry.id)));
      providerSelect.insertBefore(group, providerSelect.lastElementChild);
    }
    providerSelect.disabled = false;
    const requested = new URLSearchParams(location.search).get('provider');
    const initial = requested || providers.find(item => item.id === 'openai')?.id || providers.find(item => item.status === 'supported')?.id || 'custom';
    let catalogWarning = '';
    if (!providers.length) {
      catalogWarning = '服务商目录暂时无法读取。你仍可以手动填写服务与模型。';
    } else if (requested && requested !== 'custom' && !providers.some(item => item.id === requested)) {
      catalogWarning = '目录中没有这个服务。你可以手动填写名称或重新选择。';
    } else if (!snapshot?.sources) {
      catalogWarning = '自动同步的模型目录暂时无法读取，可手动填写模型 ID。';
    }
    byId('catalog-status').textContent = catalogWarning;
    selectProvider(initial);
  }

  start();
})();
