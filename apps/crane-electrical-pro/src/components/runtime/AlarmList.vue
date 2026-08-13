<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { RuntimeAlarm } from '@/stores/runtime'

defineProps<{
  alarms: RuntimeAlarm[]
}>()

const emit = defineEmits<{
  select: [deviceCode: string]
}>()

function levelColor(level: RuntimeAlarm['level']) {
  if (level === 'high') return 'var(--danger)'
  if (level === 'medium') return 'var(--warning)'
  return 'var(--info)'
}

function levelLabel(level: RuntimeAlarm['level']) {
  if (level === 'high') return '高'
  if (level === 'medium') return '中'
  return '低'
}
</script>

<template>
  <div class="alarm-list">
    <div class="head">报警列表 {{ alarms.length }}</div>
    <div
      v-for="a in alarms"
      :key="a.id"
      class="item"
      @click="emit('select', a.deviceCode)"
    >
      <Icon
        :icon="a.level === 'high' ? 'mdi:alert' : 'mdi:alert-circle-outline'"
        :width="18"
        :height="18"
        :style="{ color: levelColor(a.level) }"
      />
      <div class="body">
        <div class="title">#{{ a.deviceCode }} {{ a.deviceName }}</div>
        <div class="msg">{{ a.message }}</div>
        <div class="time">{{ a.time }}</div>
      </div>
      <span class="level" :style="{ color: levelColor(a.level), borderColor: levelColor(a.level) }">
        {{ levelLabel(a.level) }}
      </span>
    </div>
    <div v-if="!alarms.length" class="empty">暂无报警</div>
  </div>
</template>

<style scoped>
.alarm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.head {
  font-size: 12px;
  color: var(--text-secondary);
}

.item {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
}

.item:hover {
  border-color: var(--border-strong);
}

.body {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 12px;
  color: var(--text-primary);
}

.msg {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.time {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
}

.level {
  align-self: flex-start;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
