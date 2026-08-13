<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { RuntimeDevice } from '@/stores/runtime'
import { DEVICE_STATUS_META } from '@/utils/visual-state-map'

defineProps<{
  devices: RuntimeDevice[]
  selectedId: string
}>()

const emit = defineEmits<{
  select: [nodeId: string]
}>()
</script>

<template>
  <div class="device-list">
    <div class="head">设备列表 {{ devices.length }}</div>
    <div
      v-for="d in devices"
      :key="d.nodeId"
      class="row"
      :class="{ active: selectedId === d.nodeId }"
      @click="emit('select', d.nodeId)"
    >
      <div class="icon">
        <Icon icon="mdi:archive" :width="18" :height="18" />
      </div>
      <div class="meta">
        <div class="code">#{{ d.code }}</div>
        <div class="name">{{ d.name }}</div>
      </div>
      <div class="status" :style="{ color: DEVICE_STATUS_META[d.status].color }">
        <span class="dot" :style="{ background: DEVICE_STATUS_META[d.status].color }" />
        {{ DEVICE_STATUS_META[d.status].label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.head {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
}

.row:hover {
  background: var(--bg-hover);
}

.row.active {
  background: var(--accent-dim);
  border-color: var(--accent);
  box-shadow: inset 3px 0 0 var(--accent);
}

.icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
}

.meta {
  flex: 1;
  min-width: 0;
}

.code {
  font-size: 11px;
  color: var(--text-muted);
}

.name {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
</style>
