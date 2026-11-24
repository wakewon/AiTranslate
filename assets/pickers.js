(() => {
  const selector = '.bench select, .bench input#model';
  const controls = new WeakMap();
  let openPicker;
  let sequence = 0;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function choices(picker) {
    const source = picker.editable ? document.getElementById('model-choices') : picker.control;
    return Array.from(source?.options || []).filter(option => {
      const group = option.closest('optgroup');
      return !option.hidden && !option.disabled && !(group?.disabled || group?.hidden);
    });
  }

  function label(option) {
    return option.label || option.value;
  }

  function normalized(value) {
    return value.normalize('NFKC').toLocaleLowerCase().trim();
  }

  function close(restoreFocus = false) {
    if (!openPicker) return;
    const {picker, panel} = openPicker;
    openPicker = null;
    picker.trigger.setAttribute('aria-expanded', 'false');
    picker.trigger.removeAttribute('aria-controls');
    picker.trigger.removeAttribute('aria-activedescendant');
    if (picker.arrow) {
      picker.arrow.setAttribute('aria-expanded', 'false');
      picker.arrow.removeAttribute('aria-controls');
    }
    picker.wrapper.classList.remove('is-open');
    panel.remove();
    if (restoreFocus && picker.trigger.isConnected) picker.trigger.focus({preventScroll: true});
  }

  function position() {
    const state = openPicker;
    if (!state) return;
    const {wrapper} = state.picker;
    if (!wrapper.isConnected || !wrapper.getClientRects().length) { close(); return; }
    const anchor = wrapper.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const bottom = top + (viewport?.height || window.innerHeight);
    const right = left + (viewport?.width || window.innerWidth);
    if (anchor.bottom < top || anchor.top > bottom) { close(); return; }
    const gap = 5;
    const below = bottom - anchor.bottom - gap - 8;
    const above = anchor.top - top - gap - 8;
    const desiredHeight = Math.min(348, state.list.scrollHeight + state.empty.offsetHeight + (state.search?.offsetHeight || 0) + 30);
    const flip = below < desiredHeight && above > below;
    const width = Math.min(Math.max(anchor.width, 192), right - left - 16);
    const style = state.panel.style;
    style.width = width + 'px';
    style.left = Math.max(left + 8, Math.min(anchor.left, right - width - 8)) + 'px';
    style.maxHeight = Math.max(56, Math.min(348, flip ? above : below)) + 'px';
    style.top = (flip ? anchor.top - gap - state.panel.offsetHeight : anchor.bottom + gap) + 'px';
  }

  function highlight(index, scroll = true) {
    const state = openPicker;
    if (!state) return;
    state.rows[state.index]?.classList.remove('is-active');
    state.index = index;
    const item = state.rows[index];
    if (!item) {
      state.owner.removeAttribute('aria-activedescendant');
      return;
    }
    item.classList.add('is-active');
    state.owner.setAttribute('aria-activedescendant', item.id);
    if (scroll) {
      const listBox = state.list.getBoundingClientRect();
      const rowBox = item.getBoundingClientRect();
      if (rowBox.top < listBox.top) state.list.scrollTop += rowBox.top - listBox.top;
      if (rowBox.bottom > listBox.bottom) state.list.scrollTop += rowBox.bottom - listBox.bottom;
    }
  }

  function render(query, focusSelected = false) {
    const state = openPicker;
    if (!state) return;
    const {picker, list} = state;
    const options = choices(picker);
    state.allOptions = options;
    const words = normalized(query).split(/\s+/).filter(Boolean);
    state.query = query;
    state.matches = options.filter(option => {
      const text = normalized([label(option), option.value, option.parentElement?.label || '', option.dataset.search || ''].join(' '));
      return words.every(word => text.includes(word));
    });
    const typed = query.trim();
    let custom;
    if (picker.editable && state.search && typed && !options.some(option => option.value === typed)) {
      custom = new Option('使用「' + typed + '」作为自定义模型', typed);
      state.matches.push(custom);
    }
    state.index = -1;
    state.rows = [];
    const content = document.createDocumentFragment();
    let lastGroup;
    for (const [index, option] of state.matches.entries()) {
      const group = option.closest('optgroup');
      if (group && lastGroup !== group) {
        const heading = node('div', 'wb-picker-group', group.label);
        heading.setAttribute('role', 'presentation');
        content.append(heading);
      }
      lastGroup = group;
      const row = node('div', 'wb-picker-option', label(option));
      if (option === custom) row.classList.add('wb-picker-custom');
      row.id = list.id + '-' + index;
      row.dataset.index = String(index);
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(option.value === picker.control.value));
      state.rows.push(row);
      content.append(row);
    }
    list.replaceChildren(content);
    state.empty.hidden = Boolean(state.matches.length);
    state.empty.textContent = picker.editable
      ? (options.length ? '没有匹配的型号。可以直接使用你输入的模型名称。' : '目录中没有预设型号。可直接输入平台或本地服务提供的模型名称。')
      : '没有找到匹配项，请换一个关键词。';
    state.status.textContent = state.matches.length + ' 个选项';
    position();
    const selectedIndex = focusSelected ? state.matches.findIndex(option => option.value === picker.control.value) : -1;
    highlight(selectedIndex);
  }

  function choose(index) {
    const state = openPicker;
    const option = state?.matches[index];
    if (!option) return;
    const {control} = state.picker;
    control.value = option.value;
    close(true);
    control.dispatchEvent(new Event('input', {bubbles: true}));
    control.dispatchEvent(new Event('change', {bubbles: true}));
    refresh();
  }

  function open(picker, query = '', focusSelected = true, browseModels = false) {
    if (picker.control.disabled) return;
    const withSearch = picker.searchable || browseModels;
    if (openPicker?.picker === picker && Boolean(openPicker.search) === Boolean(withSearch)) {
      if (openPicker.search) openPicker.search.value = query;
      render(query, focusSelected);
      return;
    }
    close();
    const panel = node('div', 'wb-picker-panel');
    const list = node('div', 'wb-picker-list');
    const empty = node('p', 'wb-picker-empty');
    const status = node('span', 'sr-only');
    panel.id = picker.id + '-panel';
    list.id = picker.id + '-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', picker.name);
    status.setAttribute('role', 'status');
    let search;
    if (withSearch) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', '选择' + picker.name);
      const bar = node('div', 'wb-picker-find');
      search = node('input');
      search.type = 'text';
      search.autocomplete = 'off';
      search.spellcheck = false;
      search.placeholder = picker.editable ? '搜索或输入模型 ID' : '搜索' + (picker.searchName || picker.name);
      search.setAttribute('role', 'combobox');
      search.setAttribute('aria-label', search.placeholder);
      search.setAttribute('aria-autocomplete', 'list');
      search.setAttribute('aria-expanded', 'true');
      search.setAttribute('aria-controls', list.id);
      search.value = query;
      bar.append(search);
      panel.append(bar);
      search.addEventListener('input', () => render(search.value));
      search.addEventListener('keydown', event => handleKeys(event, picker));
    }
    panel.append(list, empty, status);
    document.body.append(panel);
    openPicker = {picker, panel, list, empty, status, search, owner: search || picker.trigger, matches: [], rows: [], index: -1};
    picker.wrapper.classList.add('is-open');
    picker.trigger.setAttribute('aria-expanded', 'true');
    picker.trigger.setAttribute('aria-controls', search && !picker.editable ? panel.id : list.id);
    if (picker.arrow) {
      picker.arrow.setAttribute('aria-controls', panel.id);
      picker.arrow.setAttribute('aria-expanded', 'true');
    }
    list.addEventListener('mousedown', event => event.preventDefault());
    list.addEventListener('pointermove', event => {
      const row = event.target.closest('[role="option"]');
      if (event.pointerType === 'mouse' && row && Number(row.dataset.index) !== openPicker?.index) highlight(Number(row.dataset.index), false);
    });
    list.addEventListener('click', event => {
      const row = event.target.closest('[role="option"]');
      if (row) choose(Number(row.dataset.index));
    });
    render(query, focusSelected);
    search?.focus({preventScroll: true});
  }

  function handleKeys(event, picker) {
    if (event.isComposing || event.keyCode === 229) return;
    const state = openPicker?.picker === picker ? openPicker : null;
    const key = event.key;
    if (picker.editable && event.altKey && key === 'ArrowDown') {
      event.preventDefault();
      open(picker, '', true, true);
      openPicker?.search?.focus();
      return;
    }
    if (key === 'Tab' && state) { close(true); return; }
    if (key === 'Escape' && state) { event.preventDefault(); close(true); return; }
    const arrow = key === 'ArrowDown' || key === 'ArrowUp';
    if (arrow || (state && ['Home', 'End', 'PageUp', 'PageDown'].includes(key))) {
      if ((key === 'Home' || key === 'End') && (state.search || picker.editable) && state.index < 0) return;
      event.preventDefault();
      if (!state) { open(picker); if (openPicker?.index >= 0) return; }
      const current = openPicker;
      if (!current?.matches.length) return;
      const last = current.matches.length - 1;
      let next;
      if (key === 'Home') next = 0;
      else if (key === 'End') next = last;
      else {
        const step = key.startsWith('Page') ? Math.max(1, Math.floor(current.list.clientHeight / 38)) : 1;
        const down = key === 'ArrowDown' || key === 'PageDown';
        next = current.index < 0 ? (down ? 0 : last) : Math.max(0, Math.min(last, current.index + (down ? step : -step)));
      }
      highlight(next);
      return;
    }
    if (state && key === 'Enter') {
      event.preventDefault();
      if (state.index >= 0) choose(state.index);
      else if (state.search && state.matches.length) choose(0);
      else close(true);
    } else if (!state && !picker.editable && (key === 'Enter' || key === ' ')) {
      event.preventDefault();
      open(picker);
    } else if (state && !state.search && !picker.editable && key === ' ') {
      event.preventDefault();
      if (state.index >= 0) choose(state.index);
    } else if (!picker.editable && !event.altKey && !event.metaKey && !event.ctrlKey && key.length === 1 && !state?.search) {
      event.preventDefault();
      if (picker.searchable) { open(picker, key, false); return; }
      if (!state) open(picker);
      if (!openPicker) return;
      const now = performance.now();
      picker.prefix = now - (picker.typedAt || 0) < 650 ? (picker.prefix || '') + key : key;
      picker.typedAt = now;
      const index = openPicker.matches.findIndex(option => normalized(label(option)).startsWith(normalized(picker.prefix)));
      if (index >= 0) highlight(index);
    }
  }

  function sync(picker) {
    const {control, trigger} = picker;
    const associated = control.labels?.[0];
    picker.name = control.getAttribute('aria-label') || associated?.textContent.trim() || (picker.editable ? '模型' : '选项');
    picker.searchName = {provider: '服务商', model: '模型', template: '参数示例'}[control.id];
    picker.wrapper.hidden = control.hidden;
    if (picker.editable) {
      picker.arrow.disabled = control.disabled;
    } else {
      picker.searchable = control.id === 'provider' || choices(picker).length > 5;
      const value = control.selectedOptions[0];
      picker.caption.textContent = value ? label(value) : '请选择';
      trigger.setAttribute('aria-label', picker.name + '，' + picker.caption.textContent);
      trigger.setAttribute('aria-haspopup', picker.searchable ? 'dialog' : 'listbox');
      if (picker.searchable) trigger.removeAttribute('role');
      else trigger.setAttribute('role', 'combobox');
      trigger.disabled = control.disabled;
    }
  }

  function enhance(control) {
    const editable = control.id === 'model';
    const wrapper = node('div', 'wb-picker' + (editable ? ' wb-picker-model' : ''));
    const id = 'wb-pick-' + ++sequence;
    const picker = {id, control, editable, wrapper};
    controls.set(control, picker);
    control.before(wrapper);
    wrapper.append(control);
    if (editable) {
      control.removeAttribute('list');
      control.setAttribute('role', 'combobox');
      control.setAttribute('aria-autocomplete', 'list');
      control.setAttribute('aria-haspopup', 'listbox');
      picker.trigger = control;
      const arrow = node('button', 'wb-picker-arrow');
      arrow.type = 'button';
      arrow.setAttribute('aria-label', '搜索或查看全部模型');
      arrow.setAttribute('aria-haspopup', 'dialog');
      arrow.setAttribute('aria-expanded', 'false');
      wrapper.append(arrow);
      picker.arrow = arrow;
      arrow.addEventListener('mousedown', event => event.preventDefault());
      arrow.addEventListener('click', () => {
        control.focus({preventScroll: true});
        if (openPicker?.picker === picker && !openPicker.query && openPicker.search) close();
        else {
          open(picker, '', true, true);
          openPicker?.search?.focus();
        }
      });
      let firstPointerFocus = false;
      control.addEventListener('pointerdown', event => {
        firstPointerFocus = document.activeElement !== control && event.button === 0 && !event.shiftKey;
      });
      control.addEventListener('focus', () => { if (!firstPointerFocus) control.select(); });
      control.addEventListener('blur', () => { firstPointerFocus = false; });
      control.addEventListener('click', event => {
        if (firstPointerFocus && event.detail === 1 && control.selectionStart === control.selectionEnd) control.select();
        firstPointerFocus = false;
        if (openPicker?.picker !== picker || openPicker.search) open(picker);
      });
      control.addEventListener('input', event => {
        if (event.isTrusted && !event.isComposing) open(picker, control.value, false);
      });
      control.addEventListener('compositionend', () => open(picker, control.value, false));
    } else {
      const trigger = node('button', 'wb-picker-trigger');
      trigger.type = 'button';
      picker.caption = node('span', 'wb-picker-caption');
      trigger.append(picker.caption);
      wrapper.append(trigger);
      control.classList.add('wb-picker-source');
      control.setAttribute('aria-hidden', 'true');
      control.tabIndex = -1;
      picker.trigger = trigger;
      trigger.addEventListener('click', () => openPicker?.picker === picker ? close(true) : open(picker));
      control.addEventListener('focus', () => trigger.focus());
      control.addEventListener('change', () => sync(picker));
      control.labels?.[0]?.addEventListener('click', event => {
        if (!control.disabled && event.target.tagName === 'LABEL') {
          event.preventDefault();
          trigger.focus();
        }
      });
    }
    picker.trigger.setAttribute('aria-expanded', 'false');
    picker.trigger.addEventListener('keydown', event => handleKeys(event, picker));
    sync(picker);
    return picker;
  }

  function refresh() {
    for (const control of document.querySelectorAll(selector)) {
      const picker = controls.get(control);
      if (picker) sync(picker);
      else enhance(control);
    }
    if (openPicker) {
      const {picker, query, allOptions, search} = openPicker;
      if (picker.control.disabled || !picker.wrapper.getClientRects().length) close();
      else {
        const current = choices(picker);
        const changed = current.length !== allOptions.length || current.some((option, index) => option !== allOptions[index]);
        if (changed && search) search.value = '';
        render(changed ? '' : query, changed || !query);
      }
    }
  }

  function init() {
    refresh();
    new MutationObserver(records => {
      if (openPicker && !openPicker.picker.wrapper.isConnected) close();
      if (records.some(record => record.target.closest?.('select, #model-choices') ||
        (record.type === 'attributes' && record.target.id === 'model') ||
        [...record.addedNodes].some(n => n.nodeType === 1 && (n.matches('select, #model') || n.querySelector('select, #model'))))) refresh();
    }).observe(document.querySelector('.bench') || document.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ['disabled', 'selected', 'value', 'label', 'hidden', 'placeholder']});
    document.addEventListener('pointerdown', event => {
      if (openPicker && !openPicker.picker.wrapper.contains(event.target) && !openPicker.panel.contains(event.target)) close();
    }, true);
    document.addEventListener('focusin', event => {
      if (openPicker && !openPicker.picker.wrapper.contains(event.target) && !openPicker.panel.contains(event.target)) close();
    });
    document.addEventListener('scroll', event => {
      if (openPicker && !openPicker.panel.contains(event.target)) position();
    }, true);
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
  }

  window.WorkbenchPickers = {refresh, focus(control) { (controls.get(control)?.trigger || control)?.focus(); }};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
