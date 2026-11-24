(() => {
  const byId = (id) => document.getElementById(id);
  const providerSelect = byId('provider');
  const modelInput = byId('model');
  const formatSelect = byId('format');
  const authSelect = byId('auth-mode');
  const toolButtons = [...document.querySelectorAll('.bench-tool-toggle')];
  const unselected = { id: '', name: '', status: 'unselected' };
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
  let toastOwner;
  const copyRequests = new WeakMap();
  let returningToQuestion = false;

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function selectLabel(select) {
    return select.selectedOptions[0]?.textContent || '';
  }

  function setTool(hash, writeURL = false) {
    const target = hash === 'thinking' ? 'lookup' : hash;
    for (const button of toolButtons) {
      const id = button.getAttribute('aria-controls');
      const open = id === target && !button.closest('.bench-tool').hidden;
      button.setAttribute('aria-expanded', String(open));
      byId(id).hidden = !open;
    }
    if (target === 'lookup') {
      byId(hash === 'thinking' ? 'lookup-thinking' : 'lookup-connection').checked = true;
      renderPrompts();
    }
    if (writeURL) {
      const url = new URL(location.href);
      url.hash = hash;
      replaceLocation(url);
    }
  }

  function replaceLocation(url) {
    try { history.replaceState(null, '', url); } catch { /* Local previews can restrict history updates. */ }
  }

  for (const button of toolButtons) {
    button.addEventListener('click', () => {
      const target = button.getAttribute('aria-controls');
      setTool(button.getAttribute('aria-expanded') === 'true' ? '' : target, true);
    });
  }
  function followHash() {
    const hash = location.hash.slice(1);
    setTool(hash);
    const target = hash === 'thinking' ? 'lookup' : hash;
    const toggle = byId('tab-' + target);
    if (toggle && !toggle.closest('.bench-tool').hidden) toggle.scrollIntoView({block: 'start'});
  }
  window.addEventListener('hashchange', followHash);
  byId('lookup-kind').addEventListener('change', () => setTool(byId('lookup-thinking').checked ? 'thinking' : 'lookup', true));
  byId('choose-for-lookup').addEventListener('click', () => {
    returningToQuestion = true;
    const field = selected === custom ? byId('custom-name') : providerSelect;
    field.focus();
    field.scrollIntoView({block: 'center'});
  });
  byId('return-to-question').addEventListener('click', () => {
    returningToQuestion = false;
    byId('return-to-question').hidden = true;
    document.querySelector('[data-copy="lookup-output"]').focus();
  });
  for (const shortcut of document.querySelectorAll('[data-preset]')) {
    shortcut.addEventListener('click', () => {
      providerSelect.value = shortcut.dataset.preset;
      providerSelect.dispatchEvent(new Event('change'));
      providerSelect.focus();
    });
  }

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
        ? '选好平台后，这里会列出需要填写的内容。'
        : '这个服务目前无法接入。请在第 1 步改选其他平台。';
      return;
    }
    const name = selected === custom ? byId('custom-name').value.trim() || '自定义服务' : selected.name;
    byId('field-title').textContent = name + (/[a-z0-9]$/i.test(name) ? ' 的填写方式' : '的填写方式');
    const baseURL = byId('base-url').value.trim();
    const token = baseURL.match(/\{[^}]+\}/)?.[0];
    const endpoint = byId('endpoint').value.trim();
    const list = byId('field-list');
    const defaults = byId('default-list');
    list.replaceChildren();
    defaults.replaceChildren();
    const formatField = field('请求格式', selectLabel(formatSelect), 'out-format', '', false);
    (formatSelect.value === 'openai_chat' ? defaults : list).append(formatField);
    list.append(field('Base URL', baseURL, 'out-base', '先在第 1 步填写服务地址', !token));
    (endpoint ? list : defaults).append(field('端点路径覆盖', endpoint, 'out-endpoint', '留空'));
    list.append(field('API Key', keyInstruction(), 'out-key', '', false));
    const optionalAuth = authSelect.value === 'auto' || (authSelect.value === 'none' && selected.authMode === 'none');
    const authField = field('鉴权方式', selectLabel(authSelect), 'out-auth', '', false);
    (optionalAuth ? defaults : list).append(authField);
    list.append(field('模型', modelInput.value.trim(), 'out-model', '先在第 1 步填入模型名称或部署名'));
    byId('defaults').hidden = !defaults.children.length;
    byId('credential-note').textContent = token ? '请先在第 1 步将 ' + token + ' 换成你的实际取值，再复制服务地址。' : '';
    byId('default-auth-tip').hidden = !(optionalAuth && authSelect.value === 'none');
  }

  function showPreparation() {
    const guide = byId('provider-guide');
    byId('prepare-guide').hidden = selected === unselected;
    guide.hidden = !(selected.bob || selected.docs);
    if (selected === unselected) return;
    let title = '准备一把密钥';
    let message = '登录「' + selected.name + '」的开发者平台，创建 API Key（密钥）。下一步直接把它粘贴到 Bob。';
    let link = selected.bob ? '查看密钥申请教程' : '打开服务商文档';
    if (selected === custom) {
      title = '先向服务提供方确认';
      message = '请管理员提供服务地址、模型名称和密钥要求。如果使用代理，地址和密钥都应来自代理平台。';
    } else if (selected.status === 'unavailable') {
      title = '服务已下线';
      message = selected.note;
      link = '查看 Bob 的服务说明';
    } else if (selected.id === 'bilibili') {
      title = '无需申请密钥';
      message = '可以直接使用 bilibili 的公共翻译服务。下面已经选好一个模型，你可以先用它试译。';
      link = '查看 Bob 的使用说明';
    } else if (selected.group === 'local') {
      title = '先启动模型服务';
      message = selected.id === 'ollama' ? '在 Mac 上启动 Ollama，确认已经下载了要用的对话模型。默认本机连接可把密钥留空。'
        : selected.id === 'lmstudio' ? '在 LM Studio 载入模型，然后到 Developer 启动服务器。开启了令牌验证时，需要在 Bob 中填写令牌。'
        : '启动自己的模型服务器，确认能访问服务地址。如果服务器开启了密钥验证，准备同一把密钥。';
      link = selected.bob ? '查看本地配置教程' : '查看服务启动说明';
    } else if (selected.id === 'azure') {
      title = '准备 Azure 资源';
      message = '从 Azure 资源中复制密钥、资源地址和部署名称。三个值都要来自你正在使用的资源。';
    } else if (selected.group === 'gateway') {
      message = '在「' + selected.name + '」创建自己的 API Key。即使选择其他公司的模型，也要使用这个平台发给你的密钥。';
    }
    byId('prepare-title').textContent = title;
    byId('prepare-copy').textContent = message;
    if (!guide.hidden) {
      guide.href = selected.bob || selected.docs;
      guide.textContent = link + ' ↗';
    }
  }

  function renderModelDetails() {
    const source = sources[selected.id];
    const model = source?.models.find(item => item.id === modelInput.value.trim());
    const example = selected.id !== 'bilibili' && selected.models?.includes(modelInput.value.trim());
    byId('model-hint').textContent = (example ? '这里预填了一个示例，可换成你已开通的模型。' : '') + (selected.modelHint || '');
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
    if (byId('lookup-thinking').checked) {
      context.push('', '我刚开始用 Bob，希望划词后能更快看到译文。请查这个平台的官方文档，确认所选模型在这个接口能否关闭思考，或能否选择较低的思考等级。');
      context.push('先用一句话告诉我能做什么，再按 Bob 界面的字段名给出操作步骤。若只需改「额外请求体」，就只给那一项可以复制的 JSON，省略 SDK 包装层，并说明其他设置可保留默认。请说明最低支持的等级并附上官方来源；如果没有明确依据，请直接说明。');
    } else {
      context.push('', '我是第一次使用 Bob，请查这个服务商的官方文档，帮我把它接入「Ai 翻译」插件。先告诉我到哪里申请密钥、找到当前账号能用的模型；本机服务则说明要先启动什么。');
      context.push('然后按 Bob 里的字段名列出要填或更改的项目，例如「Base URL」「模型」「API Key」。对于「请求格式」「端点路径覆盖」「鉴权方式」，只展开这个服务需要改的项，其余用一句话说明能否保留默认。需要专属地址或部署名时，请具体说从哪里复制。请用占位符演示密钥。');
      context.push('最后告诉我如何点击「验证」、开启服务并「保存」，附上官方资料链接。若还缺服务地址、地区或部署方式，请先问我。只有这个端点需要额外请求头或查询参数时才给 JSON 写法。');
    }
    const ready = selected !== unselected && (selected !== custom || byId('custom-name').value.trim() || byId('base-url').value.trim());
    const thinking = byId('lookup-thinking').checked;
    setCopyText('lookup-output', ready ? context.join('\n') : '');
    byId('lookup-preview').hidden = !ready;
    byId('choose-for-lookup').hidden = Boolean(ready);
    byId('return-to-question').hidden = !returningToQuestion || !ready;
    byId('choose-for-lookup').textContent = selected === custom ? '填写服务名称或地址 ↑' : '先选择服务商 ↑';
    byId('question-title').textContent = thinking ? '向助手询问思考设置' : '向助手询问插件设置';
    byId('question-context').textContent = ready
      ? '问题中包含「' + name + '」' + (modelInput.value.trim() ? '和模型 ' + modelInput.value.trim() : '') + '。'
      : '先在第 1 步选择平台或填写自建服务，再复制适合它的问题。';
    document.querySelector('[data-copy="lookup-output"]').disabled = !ready;
  }

  function selectProvider(id) {
    selected = id ? providers.find(item => item.id === id) || custom : unselected;
    byId('start-shortcuts').hidden = selected !== unselected;
    showPreparation();
    providerSelect.value = selected.id;
    byId('custom-field').hidden = selected !== custom;
    byId('provider-note').textContent = selected.note || '';
    byId('provider-note-wrap').hidden = !selected.note && !selected.docs;
    byId('provider-docs').hidden = !selected.docs;
    if (selected.docs) byId('provider-docs').href = selected.docs;
    const available = selected.status === 'supported';
    byId('editable-connection').hidden = !available;
    byId('tab-prompts').closest('.bench-tool').hidden = selected.status === 'unavailable';
    byId('tab-parameters').closest('.bench-tool').hidden = selected.status === 'unavailable';
    byId('base-url').value = selected.baseURL || '';
    byId('endpoint').value = selected.endpointOverride || '';
    formatSelect.value = selected.format || custom.format;
    authSelect.value = selected.authMode || custom.authMode;
    const source = sources[selected.id];
    const models = source?.models.map(item => item.id) || selected.models || [];
    byId('model-choices').replaceChildren(...models.map(id => new Option(id, id)));
    modelInput.value = (selected.models || []).find(id => models.includes(id)) || '';
    modelInput.placeholder = models.length ? '输入名称查找模型，或粘贴模型 ID' : '粘贴模型名称或部署名';
    const addressRequired = selected === custom || /[{}<>]/.test(selected.baseURL || '');
    byId(addressRequired ? 'required-address' : 'optional-address').append(byId('address-field'));
    byId('address-hint').textContent = selected.id === 'azure' ? '将 {resource} 换成你的 Azure 资源名称。'
      : selected.id === 'qwen' ? '将 {WorkspaceId} 换成业务空间 ID，或粘贴控制台显示的地域域名。'
      : selected === custom ? '填写管理员提供的基础地址。若还需要单独填写接口路径，在下方修改连接方式。' : '';
    byId('snapshot-hint').textContent = source?.models.length
      ? '目录收录 ' + source.models.length + ' 个模型，可在输入框中检索。' + (source.updatedAt ? '最近变更于 ' + source.updatedAt + '。' : '')
      : '';
    byId('bilibili-template').hidden = selected.id !== 'bilibili';
    byId('connection-options').open = false;
    byId('provider-note-wrap').open = false;
    byId('defaults').open = false;
    byId('model-details').open = false;
    restoreRows();
    renderFields();
    renderModelDetails();
    renderPrompts();
    setTool(location.hash.slice(1));
  }

  providerSelect.addEventListener('change', () => {
    rememberRows();
    const url = new URL(location.href);
    if (providerSelect.value) url.searchParams.set('provider', providerSelect.value);
    else url.searchParams.delete('provider');
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
    setTool('parameters', true);
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
    setCopyText('json-output', messages.length ? '请先修正下面标出的参数。' : JSON.stringify(output, null, 2));
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
    notify(button.dataset.copy === 'lookup-output' ? '问题已复制，粘贴到能联网的 AI 助手中即可。' : '已复制', button);
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
    const requested = new URLSearchParams(location.search).get('provider');
    const initial = requested || (providers.length ? '' : 'custom');
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
    if (location.hash) followHash();
  }

  start();
})();
