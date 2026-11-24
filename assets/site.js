(() => {
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const key = 'ai-translate-theme';
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  function applyTheme() {
    root.dataset.theme = ['dark', 'light'].includes(preference) ? preference : (system.matches ? 'dark' : 'light');
    const toggle = document.querySelector('.theme-switch');
    if (toggle) toggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  }
  applyTheme();
  system.addEventListener('change', applyTheme);
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    document.querySelector('.theme-switch')?.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      applyTheme();
    });
  });
})();
