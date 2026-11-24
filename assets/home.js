(() => {
  const select = selector => document.querySelector(selector);

  const samples = [
    { lang: 'en', label: '英语原文', lines: ['A quiet morning,', 'an open book.'], translation: '清晨静好，书卷初开。' },
    { lang: 'fr', label: '法语原文', lines: ['La pluie dessine', 'sur les vitres.'], translation: '雨在窗上作画。' },
    { lang: 'en', label: '英语原文', lines: ['Good design leaves', 'room to breathe.'], translation: '好的设计，留有呼吸的空间。' }
  ];
  let sampleIndex = 0;
  function changeSample(step) {
    sampleIndex = (sampleIndex + step + samples.length) % samples.length;
    const sample = samples[sampleIndex];
    const excerpt = select('#source-excerpt');
    excerpt.lang = sample.lang;
    excerpt.replaceChildren(sample.lines[0], document.createElement('br'), sample.lines[1]);
    select('#source-lang').textContent = sample.label;
    select('#source-code').textContent = sample.lang.toUpperCase();
    select('#translated-excerpt').textContent = sample.translation;
    select('#sample-index').textContent = String(sampleIndex + 1).padStart(2, '0') + ' / 03';
    select('#sample-announcement').textContent = sample.lines.join(' ') + ' ' + sample.translation;
    select('.specimen').classList.add('changing');
  }
  select('.specimen').addEventListener('animationend', event => event.currentTarget.classList.remove('changing'));
  select('#previous-sample').addEventListener('click', () => changeSample(-1));
  select('#next-sample').addEventListener('click', () => changeSample(1));
  select('.sample-controls').hidden = false;

  const formats = {
    openai_chat: 'OpenAI Chat Completions', openai_responses: 'OpenAI Responses',
    openai_completions: 'OpenAI Legacy Completions', anthropic_messages: 'Claude Messages',
    anthropic_openai_chat: 'Claude OpenAI 兼容', gemini_generate_content: 'Gemini generateContent',
    gemini_openai_chat: 'Gemini OpenAI 兼容'
  };
  const authNames = {
    auto: '按请求格式', authorization: 'Bearer Token', 'x-api-key': 'x-api-key',
    'x-goog-api-key': 'x-goog-api-key', 'api-key': 'api-key', 'query-key': '查询参数 key', none: '手动或无需鉴权'
  };
  const groups = { cloud: '云服务', gateway: '聚合平台', local: '本地部署', other: '其他' };
  const pageSize = 6;
  const results = select('#directory-results');
  const message = select('#directory-message');
  const search = select('#provider-search');
  const filters = [...document.querySelectorAll('[data-group]')];
  let directory = [];
  let activeGroup = 'all';
  let page = 0;

  function providerRow(provider) {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = provider.name;
    const sub = document.createElement('small');
    sub.textContent = provider.baseURL ? provider.baseURL.replace(/^https?:\/\//, '').replace(/\/$/, '') : groups[provider.group];
    name.append(sub);
    row.append(name);
    const supported = provider.status === 'supported';
    row.insertCell().textContent = supported ? formats[provider.format] : '未提供兼容配置';
    const auth = provider.authMode === 'auto' ? (provider.format === 'gemini_generate_content' ? 'x-goog-api-key' : 'authorization') : provider.authMode;
    row.insertCell().textContent = supported ? authNames[auth] : '—';
    const link = document.createElement('a');
    link.href = supported ? 'tools/param-builder.html?provider=' + encodeURIComponent(provider.id) : provider.bob || provider.docs;
    link.textContent = supported ? '配置 →' : '说明 ↗';
    link.setAttribute('aria-label', (supported ? '配置 ' : '查看服务说明 ') + provider.name);
    row.insertCell().append(link);
    return row;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const matching = directory.filter(item =>
      (activeGroup === 'all' || item.group === activeGroup) && item.searchText.includes(query));
    const pageCount = Math.ceil(matching.length / pageSize);
    const first = page * pageSize;
    const rows = matching.slice(first, first + pageSize);
    select('#provider-rows').replaceChildren(...rows.map(providerRow));
    select('.provider-table').hidden = !rows.length;
    message.hidden = Boolean(rows.length);
    if (!rows.length) message.textContent = '没有找到匹配的服务。可更换关键词，或在工作台配置其他服务商。';
    select('#directory-count').textContent = matching.length
      ? '显示 ' + (first + 1) + '–' + (first + rows.length) + ' 项，共 ' + matching.length + ' 项'
      : '共 0 项';
    select('.page-controls').hidden = pageCount <= 1;
    select('#page-indicator').textContent = (page + 1) + ' / ' + pageCount;
    select('#page-prev').disabled = page === 0;
    select('#page-next').disabled = page + 1 >= pageCount;
  }

  async function loadJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }

  async function loadDirectory() {
    const embedded = window.AiTranslateData;
    const [catalog, snapshot] = embedded ? [embedded.providers, embedded.modelCatalog] : await Promise.all([
      loadJSON('data/providers.json'), loadJSON('data/model-catalog.json').catch(() => null)
    ]);

    directory = catalog.providers.map(provider => {
      const modelIds = snapshot?.sources?.[provider.id]?.models?.map(model => model.id) || [];
      const terms = [provider.name, provider.id, provider.baseURL, provider.note, provider.format,
        formats[provider.format], groups[provider.group], ...(provider.models || []), ...modelIds];
      return { ...provider, searchText: terms.filter(Boolean).join(' ').toLowerCase() };
    });
    for (const button of filters) {
      const group = button.dataset.group;
      button.hidden = group !== 'all' && !directory.some(provider => provider.group === group);
      button.addEventListener('click', () => {
        activeGroup = group;
        page = 0;
        for (const filter of filters) filter.setAttribute('aria-pressed', String(filter === button));
        render();
      });
    }
    search.addEventListener('input', () => { page = 0; render(); });
    select('#page-prev').addEventListener('click', () => { page--; render(); });
    select('#page-next').addEventListener('click', () => { page++; render(); });
    render();
    select('.directory-tools').hidden = false;
    select('.directory-foot').hidden = false;
  }

  loadDirectory().catch(() => {
    const link = document.createElement('a');
    link.href = 'docs/basic-usage.html#authentication';
    link.textContent = '查看配置指南';
    message.replaceChildren('服务商目录未能载入。', link);
  }).finally(() => results.setAttribute('aria-busy', 'false'));

  // Use the published package verified by the release workflow.
  if (location.protocol !== 'file:') loadJSON('appcast.json').then(appcast => {
    const version = appcast.versions[0];
    if (version?.url?.startsWith('https://github.com/wakewon/AiTranslate/releases/download/')) {
      select('#download').href = version.url;
      select('#download').title = '下载 AiTranslate v' + version.version;
    }
  }).catch(() => { /* The link in the HTML opens the latest release. */ });
})();
