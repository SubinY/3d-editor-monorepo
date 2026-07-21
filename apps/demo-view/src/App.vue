<template>
  <router-view />
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-bg: #0c1021;
  --color-surface: #141829;
  --color-surface-elevated: #1a1f36;
  --color-border: rgba(77, 163, 255, 0.15);
  --color-border-active: rgba(77, 163, 255, 0.5);
  --color-primary: #4da3ff;
  --color-primary-dim: rgba(77, 163, 255, 0.15);
  --color-accent: #2de3a2;
  --color-danger: #ff4d6a;
  --color-warning: #f5a623;
  --color-text: #e2e8f0;
  --color-text-secondary: rgba(226, 232, 240, 0.55);
  --color-text-muted: rgba(226, 232, 240, 0.3);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-panel: 0 4px 24px rgba(0, 0, 0, 0.4);
  --font-family: 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif;
  --font-mono: 'Cascadia Code', 'Fira Code', monospace;
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}

body {
  margin: 0;
  overflow: hidden;
  font-family: var(--font-family);
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(77, 163, 255, 0.2);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(77, 163, 255, 0.4);
}
</style>
