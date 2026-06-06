const STORAGE_KEY = 'alphacarnes-theme';

const DARK = {
  bgPrimary: '#0a0f1e', bgSecondary: '#0f172a', bgTertiary: '#1e293b',
  textPrimary: '#e2e8f0', textSecondary: '#94a3b8', textMuted: '#64748b',
  edgeColor: '#475569', edgeDimmed: '#1e293b', highlightColor: '#06b6d4',
  nodeTextOutline: '#0a0f1e', edgeLabelBg: '#0f172a',
  dimmedNodeText: '#64748b', initialBorder: '#e2e8f0',
  mermaid: {
    theme: 'dark', darkMode: true, bg: '#0f172a', primary: '#06b6d4',
    text: '#e2e8f0', border: '#1e293b', line: '#94a3b8', secondary: '#1e293b',
  },
  particles: { colors: ['#06b6d4', '#10b981'], linkColor: '#06b6d4' },
};

const LIGHT = {
  bgPrimary: '#f8fafc', bgSecondary: '#f1f5f9', bgTertiary: '#e2e8f0',
  textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8',
  edgeColor: '#94a3b8', edgeDimmed: '#cbd5e1', highlightColor: '#0891b2',
  nodeTextOutline: '#f8fafc', edgeLabelBg: '#f1f5f9',
  dimmedNodeText: '#94a3b8', initialBorder: '#0f172a',
  mermaid: {
    theme: 'default', darkMode: false, bg: '#f1f5f9', primary: '#0891b2',
    text: '#0f172a', border: '#e2e8f0', line: '#475569', secondary: '#e2e8f0',
  },
  particles: { colors: ['#0891b2', '#059669'], linkColor: '#0891b2' },
};

let current = 'dark';
const listeners = new Set();

export function getTheme() { return current; }
export function getColors() { return current === 'dark' ? DARK : LIGHT; }
export function onThemeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function toggleTheme() { setTheme(current === 'dark' ? 'light' : 'dark'); }

export function setTheme(theme) {
  current = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.add('theme-transitioning');
  localStorage.setItem(STORAGE_KEY, theme);
  listeners.forEach((fn) => fn(theme, theme === 'dark' ? DARK : LIGHT));
  setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
}

export function initTheme() {
  current = document.documentElement.dataset.theme || 'dark';
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) setTheme(e.matches ? 'light' : 'dark');
  });
}
