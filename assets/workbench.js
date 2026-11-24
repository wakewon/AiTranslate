(() => {
  const byId = (id) => document.getElementById(id);
  const providerSelect = byId('provider');
  const modelInput = byId('model');
  const formatSelect = byId('format');
  const authSelect = byId('auth-mode');
  const tabs = [...document.querySelectorAll('[role=tab]')];
  const unselected = { id: '', name: '', status: 'unselected' };
  const custom = {
    id: 'custom', name: '自定义服务商', status: 'supported', models: [],
    format: 'openai_chat', authMode: 'auto', baseURL: '', endpointOverride: '',
    modelHint: '使用服务商控制台或本地服务器列出的完整模型 ID。'
  };
  let providers = [];
  let sources = {};
  let selected = custom;
  let catalogModelIds = new Set();
  let currentSearch = location.search;
  let contextKey = '';
  let choices = [];
  let strength = '';
  let toastTimer;
  let toastOwner;
  const copyRequests = new WeakMap();

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function selectLabel(select) {
    return select.selectedOptions[0]?.textContent || '';
  }

  function replaceLocation(url) {
    try { history.replaceState(null, '', url); } catch { /* Some file viewers restrict history. */ }
    currentSearch = location.search;
  }

  function followHash() {
    const hash = location.hash.slice(1);
    const thinking = hash === 'thinking' || hash === 'parameters';
    for (const tab of tabs) {
      const active = (tab.id === 'tab-thinking') === thinking;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      byId(tab.getAttribute('aria-controls')).hidden = !active;
    }
    if (hash === 'parameters') byId('manual-parameters').open = true;
    if (hash === 'prompts' || hash === 'lookup') byId(hash).open = true;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { location.hash = tab.id.slice(4); followHash(); });
    tab.addEventListener('keydown', event => {
      const keys = { ArrowLeft: 1 - index, ArrowRight: 1 - index, Home: 0, End: 1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      tabs[keys[event.key]].focus();
      tabs[keys[event.key]].click();
    });
  });
  window.addEventListener('hashchange', followHash);
  followHash();

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

  function keyInstruction() {
    if (selected.id === 'bilibili' && authSelect.value === 'none') return '留空，公共翻译服务无需密钥';
    if (selected.group === 'local' && authSelect.value === 'none') return '本机服务未开启密钥验证时留空';
    if (authSelect.value === 'none') return '无需鉴权或已手动设置凭据时留空';
    if (selected === custom) return '按服务方要求填写密钥，未启用鉴权时可留空';
    if (selected.id === 'azure' && authSelect.value === 'api-key') return '粘贴你在 Azure 中复制的资源密钥';
    return '粘贴「' + selected.name + '」提供的密钥或令牌';
  }

  function renderFields() {
    const available = selected.status === 'supported';
    byId('setup-fields').hidden = !available;
    byId('compatibility-note').hidden = available;
    if (!available) {
      byId('compatibility-note').textContent = selected === unselected
        ? '选择服务商后即可查看连接字段。'
        : '此服务已下线，请选择其他服务商。';
      return;
    }
    const baseURL = byId('base-url').value.trim();
    const token = baseURL.match(/\{[^}]+\}/)?.[0];
    const endpoint = byId('endpoint').value.trim();
    const list = byId('field-list');
    const defaults = byId('default-list');
    list.replaceChildren();
    defaults.replaceChildren();
    const formatField = field('请求格式', selectLabel(formatSelect), 'out-format', '', false);
    (formatSelect.value === 'openai_chat' ? defaults : list).append(formatField);
    list.append(field('Base URL', baseURL, 'out-base', '在「连接选项」中填写服务地址', !token));
    (endpoint ? list : defaults).append(field('端点路径覆盖', endpoint, 'out-endpoint', '留空'));
    list.append(field('API Key', keyInstruction(), 'out-key', '', false));
    const optionalAuth = authSelect.value === 'auto' || (authSelect.value === 'none' && selected.authMode === 'none');
    const authField = field('鉴权方式', selectLabel(authSelect), 'out-auth', '', false);
    (optionalAuth ? defaults : list).append(authField);
    list.append(field('模型', modelInput.value.trim(), 'out-model', '填写服务商提供的模型或部署名'));
    byId('defaults').hidden = !defaults.children.length;
    byId('credential-note').textContent = token ? '在「连接选项」中将 ' + token + ' 换成你的实际取值，再复制服务地址。' : '';
    byId('default-auth-tip').hidden = !(optionalAuth && authSelect.value === 'none');
  }

  function sourceLink(id, url) {
    const link = byId(id);
    link.hidden = !url;
    if (url) link.href = url;
    else link.removeAttribute('href');
  }

  function renderMetadata() {
    const source = sources[selected.id];
    const model = source?.models.find(item => item.id === modelInput.value.trim());
    byId('model-details').hidden = !model;
    byId('model-details').open = false;
    if (!model) return;
    const details = byId('model-data');
    details.replaceChildren();
    const counts = [['上下文长度', model.contextLength], ['最大输出', model.maxOutputTokens]];
    for (const [label, count] of counts) {
      if (count != null) details.append(el('dt', label), el('dd', count.toLocaleString('zh-CN') + ' tokens'));
    }
    if (model.parameters?.length) details.append(el('dt', '公开参数'), el('dd', model.parameters.join(' · ')));
    sourceLink('model-source', source.url);
    byId('model-source').textContent = '模型目录来源' + (source.updatedAt ? ' · ' + source.updatedAt : '') + ' ↗';
  }

  function renderThinking() {
    const model = modelInput.value.trim();
    const format = formatSelect.value;
    const endpoint = byId('endpoint').value.trim();
    const baseURL = byId('base-url').value.trim();
    const key = JSON.stringify([selected.id, model, format, endpoint, baseURL]);
    if (key === contextKey) return;
    contextKey = key;
    const sourceModel = sources[selected.id]?.models.find(item => item.id === model);
    const result = window.reasoningFor({ provider: selected, model, sourceModel, format, endpoint, baseURL });
    choices = selected.status === 'supported' && model ? result.choices : [];
    const lowest = choices[0]?.value;
    strength = ['off', 'between_tools', 'minimal', 'low'].includes(lowest) ? lowest : '';
    byId('thinking-note').textContent = selected === unselected ? '选择服务商和模型，查看能否关闭思考或调低强度。'
      : selected.status !== 'supported' ? '此服务已下线，请选择其他服务商。'
      : !model ? '输入模型或部署名称，查看它支持的思考设置。' : result.note;
    sourceLink('thinking-source', selected.status === 'supported' ? result.url || selected.docs : '');
    const group = byId('thinking-choices');
    group.replaceChildren();
    byId('thinking-options').hidden = !choices.length;
    if (choices.length) {
      for (const item of [{ value: '', label: '模型默认' }, ...choices]) {
        const label = el('label');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = 'strength';
        radio.value = item.value;
        radio.checked = item.value === strength;
        label.append(radio, el('span', item.label));
        group.append(label);
      }
    }
    renderJSON();
  }
  byId('thinking-choices').addEventListener('change', event => {
    strength = event.target.value;
    renderJSON();
  });

  function renderPrompts() {
    const scene = byId('scene').value;
    const style = {
      general: '用自然、准确的表达传达原意，保留原文的语气和段落。',
      technical: '保持技术术语前后一致，保留代码、命令、路径、占位符和 Markdown 结构。',
      mail: '保留称呼、署名、日期和行动事项，使用清楚、得体的邮件措辞。'
    }[scene];
    setCopyText('system-output', '你是一名译者。' + style + '只输出译文。');
    if (selected.id === 'bilibili') {
      setCopyText('user-output', '请将以下文本翻译为 $targetLang，直接输出译文。\n\n$text');
    } else if (formatSelect.value === 'anthropic_messages') {
      setCopyText('user-output', '将 <source> 中的原文从 $sourceLang 翻译成 $targetLang。\n\n<source>\n$text\n</source>');
    } else {
      setCopyText('user-output', '请将以下原文从 $sourceLang 翻译成 $targetLang。\n\n$text');
    }
    const name = selected === custom ? byId('custom-name').value.trim() || byId('base-url').value.trim() || '自建服务' : selected.name;
    const context = ['我想在 Bob 的「Ai 翻译」插件中使用「' + name + '」。'];
    if (modelInput.value.trim()) context.push('模型或部署名：' + modelInput.value.trim());
    if (selected.status === 'supported') {
      context.push('拟用请求格式：' + selectLabel(formatSelect));
      if (byId('base-url').value.trim()) context.push('Base URL：' + byId('base-url').value.trim());
      if (byId('endpoint').value.trim()) context.push('端点路径覆盖：' + byId('endpoint').value.trim());
    }
    if (selected.docs) context.push('官方资料：' + selected.docs);
    const ready = selected.status === 'supported' && (selected !== custom || byId('custom-name').value.trim() || byId('base-url').value.trim());
    const lookup = '请核对官方文档，按 Bob 的字段列出连接此服务所需的 Base URL、模型、API Key 获取方式、请求格式与鉴权方式。如需部署名称或自定义端点，请注明在哪里获取，并附官方来源。';
    const thinking = '请根据官方文档核对这个模型与接口能否关闭思考，或支持哪些强度。给出可粘贴到 Bob「额外请求体 (JSON)」的关闭或最低强度写法，区分关闭与降低，附官方来源。若没有公开依据，请说明。';
    for (const [section, id, question] of [['lookup','lookup-output',lookup], ['thinking-query','thinking-query-output',thinking]]) {
      byId(section).hidden = !ready;
      setCopyText(id, ready ? [...context, '', question].join('\n') : '');
    }
  }

  function selectProvider(id, requestedModel = '') {
    selected = id ? providers.find(item => item.id === id) || custom : unselected;
    const available = selected.status === 'supported';
    providerSelect.value = selected.id;
    byId('custom-field').hidden = selected !== custom;
    byId('provider-note').textContent = selected.note || (selected === custom ? '使用服务提供方给出的模型名称、地址与密钥。' : '选择服务商可查看密钥、地址与模型的来源。');
    sourceLink('provider-docs', selected.docs);
    sourceLink('provider-guide', selected.bob !== selected.docs && selected.bob);
    byId('prompts').hidden = selected.status === 'unavailable';
    byId('manual-parameters').hidden = !available;
    byId('thinking-preview').hidden = !available;
    byId('base-url').value = selected.baseURL || '';
    byId('endpoint').value = selected.endpointOverride || '';
    formatSelect.value = selected.format || custom.format;
    authSelect.value = selected.authMode || custom.authMode;
    const examples = selected.models || [];
    const listed = sources[selected.id]?.models.map(item => item.id) || [];
    catalogModelIds = new Set([...examples, ...listed]);
    const models = [...catalogModelIds];
    byId('model-choices').replaceChildren(...models.map(id => new Option(id, id)));
    modelInput.disabled = !available;
    modelInput.value = catalogModelIds.has(requestedModel) ? requestedModel : examples.find(id => listed.includes(id)) || examples[0] || '';
    modelInput.placeholder = !available ? '先选择可用服务商' : models.length ? '选择或输入模型 ID' : '输入模型 ID 或部署名';
    byId('model-hint').textContent = available && !models.length ? selected.modelHint : '';
    byId('connection-options').hidden = !available;
    byId('connection-options').open = available && (selected === custom || /[{}<>]/.test(selected.baseURL || ''));
    byId('address-hint').textContent = selected.id === 'azure' ? '将 {resource} 换成你的 Azure 资源名称。'
      : selected.id === 'qwen' ? '将 {WorkspaceId} 换成业务空间 ID，或粘贴控制台的地域域名。' : '';
    byId('format-caption').textContent = selectLabel(formatSelect);
    byId('defaults').open = false;
    renderMetadata();
    restoreRows();
    renderFields();
    renderThinking();
    renderPrompts();
    window.WorkbenchPickers?.refresh();
  }

  providerSelect.addEventListener('change', () => {
    if (providerSelect.value === selected.id) return;
    rememberRows();
    const url = new URL(location.href);
    if (providerSelect.value) url.searchParams.set('provider', providerSelect.value);
    else url.searchParams.delete('provider');
    url.searchParams.delete('model');
    replaceLocation(url);
    selectProvider(providerSelect.value);
  });
  for (const id of ['model', 'custom-name', 'format', 'auth-mode', 'base-url', 'endpoint', 'scene']) {
    byId(id).addEventListener('input', () => {
      if (id === 'model') {
        renderMetadata();
        const url = new URL(location.href);
        if (catalogModelIds.has(modelInput.value)) url.searchParams.set('model', modelInput.value);
        else url.searchParams.delete('model');
        if (url.search !== location.search) replaceLocation(url);
      }
      if (id === 'format') byId('format-caption').textContent = selectLabel(formatSelect);
      if (['model', 'format', 'base-url', 'endpoint'].includes(id)) renderThinking();
      renderFields();
      renderPrompts();
    });
  }

  const typeLabels = {string: '字符串', number: '数字', boolean: '布尔值', null: 'null', object: '对象', array: '数组'};
  const templates = {
    top_p: ['0.9', 'number'],
    top_k: ['40', 'number'],
    response_format: ['{"type":"text"}', 'object']
  };
  const rowList = byId('param-rows');
  const drafts = new Map();
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
    window.WorkbenchPickers?.refresh();
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

  function mergePreset(target, preset) {
    for (const [key, value] of Object.entries(preset)) {
      if (!Object.hasOwn(target, key)) {
        target[key] = value;
        continue;
      }
      const existing = target[key];
      if (existing === value) continue;
      if (!value || typeof value !== 'object' || !existing || typeof existing !== 'object' || Array.isArray(existing)) return false;
      if (key === 'thinkingConfig' && (('thinkingLevel' in value && 'thinkingBudget' in existing) || ('thinkingBudget' in value && 'thinkingLevel' in existing))) return false;
      if (!mergePreset(existing, value)) return false;
    }
    return true;
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
    const preset = choices.find(item => item.value === strength);
    if (!messages.length && preset && !mergePreset(output, preset.body)) {
      messages.push('手填参数与所选强度冲突。请修改手填值，或选择「模型默认」后自行填写。');
    }
    const hasFields = Object.keys(output).length > 0;
    setCopyText('json-output', messages.length ? '请检查手填参数。' : JSON.stringify(output, null, 2));
    byId('param-error').textContent = messages.join(' ');
    byId('json-instruction').textContent = messages.length ? '' : hasFields
      ? '将以上字段填入 Bob 的「额外请求体 (JSON)」。已有其他参数时，保留原字段并合并。'
      : choices.length ? '使用模型默认设置时可留空。恢复默认只需移除已有的思考参数。'
        : '核对服务商文档后，可在下方手动添加请求参数。';
    document.querySelector('[data-copy="json-output"]').disabled = Boolean(messages.length) || !hasFields || selected.status !== 'supported';
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

  function notify(message, owner = null) {
    clearTimeout(toastTimer);
    toastOwner = owner;
    byId('copy-status').textContent = message;
    toastTimer = setTimeout(() => { byId('copy-status').textContent = ''; toastOwner = null; }, 3000);
  }

  function clearCopyFeedback(button) {
    const request = copyRequests.get(button);
    if (!request) return;
    clearTimeout(request.timer);
    button.textContent = request.label;
    copyRequests.delete(button);
    if (toastOwner === button) notify('');
  }

  function setCopyText(id, text) {
    const node = byId(id);
    if (node.textContent === text) return;
    clearCopyFeedback(document.querySelector('[data-copy="' + id + '"]'));
    node.textContent = text;
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('button[data-copy]');
    if (!button) return;
    const node = byId(button.dataset.copy);
    clearCopyFeedback(button);
    const request = {label: button.textContent};
    copyRequests.set(button, request);
    const current = () => button.isConnected && copyRequests.get(button) === request;
    try {
      await navigator.clipboard.writeText(node.textContent);
    } catch {
      if (!current()) return;
      const fold = node.closest('details');
      if (fold) fold.open = true;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      if (!copied) { notify('已选中文本，请使用系统复制命令。', button); return; }
      selection.removeAllRanges();
    }
    if (!current()) return;
    notify(['lookup-output', 'thinking-query-output'].includes(button.dataset.copy) ? '问题已复制，粘贴到能联网的 AI 助手中即可。' : '已复制', button);
    button.textContent = '已复制';
    request.timer = setTimeout(() => clearCopyFeedback(button), 2200);
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
    const params = new URLSearchParams(location.search);
    const requested = params.get('provider');
    const defaultProvider = providers.find(item => item.id === 'openai')?.id ?? providers[0]?.id ?? 'custom';
    const initial = requested || defaultProvider;
    let catalogWarning = '';
    if (!providers.length) {
      catalogWarning = '服务商目录暂时无法读取。你仍可以手动填写服务与模型。';
    } else if (requested && requested !== 'custom' && !providers.some(item => item.id === requested)) {
      catalogWarning = '目录中没有这个服务。你可以手动填写名称或重新选择。';
    } else if (!snapshot?.sources) {
      catalogWarning = '自动同步的模型目录暂时无法读取，可手动填写模型 ID。';
    }
    byId('catalog-status').textContent = catalogWarning;
    selectProvider(initial, params.get('model'));
    followHash();
    window.addEventListener('popstate', () => {
      if (location.search !== currentSearch) {
        currentSearch = location.search;
        const params = new URLSearchParams(currentSearch);
        rememberRows();
        selectProvider(params.get('provider') || defaultProvider, params.get('model'));
      }
      followHash();
    });
  }

  start();
})();
