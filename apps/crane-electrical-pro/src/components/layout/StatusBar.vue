<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()
const { unit, gridSizeMm, statusText, selectionCount } = storeToRefs(store)
</script>

<template>
  <footer class="status-bar">
    <div class="left">
      <span>单位: {{ unit }}</span>
      <span class="sep">|</span>
      <span>网格: {{ gridSizeMm }} mm</span>
    </div>
    <div class="center">{{ statusText }}</div>
    <div class="right">
      <span>坐标系: 世界坐标</span>
      <span class="sep">|</span>
      <span class="sel">
        选择: {{ selectionCount }} 对象
        <Icon
          v-if="selectionCount > 0"
          icon="mdi:check-circle"
          :width="14"
          :height="14"
          class="ok"
        />
      </span>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  height: var(--statusbar-h);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 14px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

.left,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.right {
  justify-content: flex-end;
}

.center {
  color: var(--text-secondary);
}

.sep {
  opacity: 0.5;
}

.sel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ok {
  color: var(--success);
}
</style>
