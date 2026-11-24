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
    const thinking = ['thinking', 'thinking-query', 'parameters'].includes(hash);
    for (const tab of tabs) {
      const active = (tab.id === 'tab-thinking') === thinking;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      byId(tab.getAttribute('aria-controls')).hidden = !active;
    }
    if (hash === 'parameters') byId('manual-parameters').open = true;
    if (['prompts', 'lookup', 'thinking-query'].includes(hash)) byId(hash).open = true;
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
    renderQueryPrompts();
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
    renderQueryPrompts();
  }

  function connectionExample() {
    if (selected.id === 'azure') return '如果 Azure 控制台同时列出基础型号和部署名称，请指出「模型」应复制哪一项、资源地址到哪里找。我的部署名称需要从自己的资源中读取。';
    if (selected.id === 'qwen') return '如果地址里有 {WorkspaceId}，请说明到哪里复制业务空间 ID，以及怎样确认域名、模型和密钥属于同一地域。';
    if (selected.group === 'local') return '本地服务的地址、端口和已加载模型取决于我的机器。请说明怎样从运行中的服务查看模型 ID，以及开启令牌验证后要改哪一项。';
    if (selected.id === 'bilibili') return '请核对公共翻译端点是否需要密钥，以及从哪里确认该端点开放的翻译型号。';
    if (selected.group === 'gateway' || selected === custom) return '如果同一个模型也由原厂提供，请按我实际连接的平台核对密钥和模型 ID。代理是否转发某个字段，需要这个代理自己的文档或部署配置来确认。';
    return '如果控制台显示模型的商品名或聊天应用的名称，请说明怎样找到能通过这个 API 调用的模型 ID，以及在哪里查看我的账号是否已开通。';
  }

  function addressExample() {
    if (byId('endpoint').value.trim()) {
      return '例如，假设文档给出 POST https://api.example.com/gateway/translate，Base URL 可以填 https://api.example.com，端点路径覆盖填 /gateway/translate。AiTranslate 会把两项拼起来。请按实际文档检查版本号和网关路径有没有重复或遗漏。';
    }
    if (formatSelect.value === 'gemini_generate_content') {
      return '例如，使用原生 generateContent 时，端点留空可让 AiTranslate 把模型 ID 填入路径，并按流式开关选用 :generateContent 或 :streamGenerateContent。若建议覆盖路径，请分别核对普通翻译和流式翻译的实际地址。';
    }
    const path = {
      anthropic_messages: '/v1/messages',
      gemini_openai_chat: '/v1beta/openai/chat/completions',
      openai_completions: '/v1/completions',
      openai_responses: '/v1/responses'
    }[formatSelect.value] || '/v1/chat/completions';
    return '例如，假设文档给出 POST https://api.example.com' + path + '，Base URL 可以填 https://api.example.com，端点路径覆盖留空，让 AiTranslate 按所选格式补上 ' + path + '。示例域名只用来演示字段拆分，请换成当前服务的实际地址。';
  }

  function thinkingExample() {
    if (formatSelect.value === 'gemini_generate_content') {
      return '以 Gemini 原生接口为例，若文档明确该型号支持零预算，写法是 {"generationConfig":{"thinkingConfig":{"thinkingBudget":0}}。使用 thinkingLevel 的型号应按各自的枚举值填写。请查明当前型号采用哪种方式，以及最低档是否仍会消耗思考 token。';
    }
    if (formatSelect.value === 'anthropic_messages') {
      return '以 Messages 接口为例，若文档列出 {"thinking":{"type":"disabled"}}，还要核对这个型号是否限制同时使用的 effort 档位。如果只能跳过答复前的思考，请解释它与完全关闭的区别。';
    }
    if (formatSelect.value === 'openai_completions') {
      return '例如，接口文档若只在 Chat Completions 一节列出推理参数，请查明当前 Legacy Completions 端点是否也接受它。如果需要更换请求格式，请说明前提。';
    }
    return '举例来说，若文档确认某型号支持 low，OpenAI Chat Completions 的写法可以是 {"reasoning_effort":"low"}，Responses 的写法可以是 {"reasoning":{"effort":"low"}}。这里演示的是字段位置，low 仍是低强度。请按实际接口给出取值，只有文档明确允许时才给关闭写法。';
  }

  function renderQueryPrompts() {
    const customName = byId('custom-name').value.trim();
    const base = byId('base-url').value.trim();
    const ready = selected.status === 'supported' && (selected !== custom || customName || base);
    byId('lookup').hidden = !ready;
    byId('thinking-query').hidden = !ready;
    if (!ready) {
      setCopyText('lookup-output', '');
      setCopyText('thinking-query-output', '');
      return;
    }

    const home = 'https://wakewon.wwang.de/AiTranslate/';
    const settings = [
      '我在 AiTranslate 配置助手中选了以下设置，请逐项核对。预填的选项也可能需要修改。',
      '服务商 = ' + (selected === custom ? customName || '自定义服务（名称未填写）' : selected.name),
      '模型或部署名 = ' + (modelInput.value.trim() || '尚未填写'),
      '请求格式 = ' + selectLabel(formatSelect),
      'Base URL = ' + (promptAddress(base) || '尚未填写'),
      '端点路径覆盖 = ' + (promptAddress(byId('endpoint').value.trim()) || '留空，由插件按请求格式生成路径'),
      '鉴权方式 = ' + selectLabel(authSelect)
    ].join('\n');

    const references = [
      '请在回答中保留插件名 AiTranslate。先查它的字段说明，再用实际接入平台的 API 文档核实模型和接口能力。',
      'AiTranslate 插件主页 ' + home,
      '如果主页无法访问，可查项目仓库中的 info.json（字段和菜单）及 main.js（请求构造） https://github.com/wakewon/AiTranslate'
    ];
    if (selected.docs) references.push('服务商文档 ' + selected.docs);
    const evidence = '请在关键结论旁附上实际查阅的文档页面，说明它适用于哪个接口或型号。如果资料打不开、文档未说明，或缺少地域、部署名等信息，请指出具体缺口，告诉我该去哪里查或请我提供哪段脱敏文档。';

    const connection = [
      '我想在 macOS 的 Bob 中用 AiTranslate 做文本翻译。请给我一份可以照着 Bob 设置界面填写的连接配置。',
      settings,
      [...references, '插件服务配置指南 ' + home + 'docs/basic-usage.html'].join('\n'),
      '请按以下方式回答',
      '1. 先说明这个平台能否通过所选接口完成文本翻译。把「请求格式」「Base URL」「端点路径覆盖」「模型」「鉴权方式」「API Key」列成表，每行写出填写值和取值依据。可留空的项请写明“留空”及插件会采用的默认行为。密钥只说明去哪里创建和填在哪里，示例统一用 <API_KEY>。',
      '2. 给出拼接后的请求 URL，用占位符代表我的私有部署。' + addressExample(),
      '3. ' + connectionExample() + ' 只有该接口确实要求附加字段时，才分别给出可粘贴到「额外请求头 (JSON)」「额外查询参数 (JSON)」或「额外请求体 (JSON)」的 JSON 对象，并指出每段要填的位置。',
      '4. 最后给一个简短的验证步骤。AiTranslate 的「验证」会发送一次非流式翻译请求。如果这个接口对流式翻译另有要求，请说明怎样用一句原文在 Bob 中复测。',
      evidence
    ];

    const preset = choices.find(item => item.value === strength);
    let candidate = choices.length ? '配置助手当前选中「模型默认」。请说明留空时这个型号的默认思考行为。'
      : '配置助手尚未确认这组模型和接口的可用档位，请从服务商资料开始查证。';
    if (preset) {
      candidate = '配置助手内置的「' + preset.label + '」候选写法如下，请核对每个字段与取值是否适用。\n' + JSON.stringify(preset.body, null, 2);
    }
    const thinkingReferences = [...references, '插件思考设置指南 ' + home + 'docs/disable-thinking.html'];
    const source = byId('thinking-source').getAttribute('href');
    if (source && source !== selected.docs) thinkingReferences.push('配置助手引用的思考参数资料 ' + source);
    const thinking = [
      '我在 macOS 的 Bob 中用 AiTranslate 翻译文本。短句翻译时，我希望尽快看到译文。请帮我确认当前模型能否关闭思考。如果必须思考，我想知道能用的最低强度或预算。',
      settings,
      candidate,
      thinkingReferences.join('\n'),
      '请按以下方式回答',
      '1. 先给出结论，再列出该模型在当前端点明确支持的开关、强度或预算，以及能查到的默认值。请分别说明“完全关闭”“降低思考量”和“只隐藏思考内容”的实际效果。如果通过聚合平台或自建代理接入，请查它是否支持并转发这些字段。',
      '2. 对有文档依据的方案，分别给出一段能粘贴到 AiTranslate「额外请求体 (JSON)」的合法 JSON。如果上面有候选写法，请逐项确认或修正。如果文档没有证实可用值，请把该项标为“未核实”，省去猜测的 JSON。插件会生成翻译消息，再合并这个对象。只给需要新增的字段，保留布尔值和数字的类型，省去 SDK 的 extra_body 包装、密钥和整份请求。',
      '3. ' + thinkingExample(),
      '4. 说明怎样应用、核对和恢复默认。比如，如果同一份额外请求体还有其他设置，请指出只需改动哪些键。如果服务商公开返回推理用量，请说明看哪个字段，以及该数据能证明什么。响应速度或界面有没有显示思考过程只能作为观察线索。',
      evidence
    ];
    setCopyText('lookup-output', connection.join('\n\n'));
    setCopyText('thinking-query-output', thinking.join('\n\n'));
  }

  // Only the externally copied description needs a redacted address.
  function promptAddress(address) {
    return address.replace(/^((?:https?:\/\/|\/\/)?)[^/?#\s]+@/i, '$1')
      .replace(/([?&](?:key|api[_-]?key|access[_-]?token|token|signature|sig|password)=)[^&#]*/gi, '$1<REDACTED>');
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
    notify(['lookup-output', 'thinking-query-output'].includes(button.dataset.copy) ? '提示词已复制，可直接粘贴到能联网的 AI 助手。' : '已复制', button);
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
