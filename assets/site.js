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
    const download = document.querySelector('[data-appcast]');
    if (download && location.protocol !== 'file:') {
      fetch(download.dataset.appcast).then(response => {
        if (!response.ok) throw new Error('Release metadata unavailable');
        return response.json();
      }).then(appcast => {
        const release = appcast.versions[0];
        if (release?.url?.startsWith('https://github.com/wakewon/AiTranslate/releases/download/')) {
          download.href = release.url;
          download.title = '下载 AiTranslate v' + release.version;
        }
      }).catch(() => { /* The HTML link opens the release page if metadata is unavailable. */ });
    }
    document.querySelector('.theme-switch')?.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      applyTheme();
    });
  });
})();
