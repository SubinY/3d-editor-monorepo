<script setup lang="ts">
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3B82F6',
    primaryColorHover: '#60A5FA',
    primaryColorPressed: '#1D4ED8',
    primaryColorSuppl: '#3B82F6',
    bodyColor: '#0B1220',
    cardColor: '#111827',
    modalColor: '#1A2332',
    popoverColor: '#1A2332',
    borderColor: '#1F2A3C',
    dividerColor: '#1F2A3C',
    textColorBase: '#E8EEF7',
    textColor1: '#E8EEF7',
    textColor2: '#94A3B8',
    textColor3: '#64748B',
    hoverColor: '#243044',
    pressedColor: '#2A3A52',
    borderRadius: '6px'
  },
  Button: {
    heightMedium: '32px',
    borderRadiusMedium: '6px'
  },
  Input: {
    heightMedium: '32px'
  },
  Tabs: {
    tabTextColorActiveLine: '#3B82F6',
    barColor: '#3B82F6'
  }
}
</script>

<template>
  <NConfigProvider class="app-root" :theme="darkTheme" :theme-overrides="themeOverrides">
    <NMessageProvider class="app-root">
      <NDialogProvider class="app-root">
        <router-view :key="$route.fullPath" />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
.app-root {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-root > * {
  flex: 1;
  min-height: 0;
}
</style>
