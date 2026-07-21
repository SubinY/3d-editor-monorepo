<template>
  <div class="panel-content">
    <div v-for="item in stats" :key="item.label" class="status-item">
      <div class="status-icon" :style="{ color: item.color }">
        <Icon :icon="item.icon" />
      </div>
      <div class="status-info">
        <div class="status-en">{{ item.en }}</div>
        <div class="status-label">{{ item.label }}</div>
      </div>
      <div class="status-value">
        <span class="num">{{ item.value }}</span>
        <span class="unit">台</span>
      </div>
      <div class="status-bg" :style="{ background: `linear-gradient(90deg, ${item.color}22, transparent)` }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const stats = [
  { label: '运行中', en: 'In Service', value: 18, color: '#2de3a2', icon: 'mdi:cog-play' },
  { label: '待机', en: 'Standby', value: 12, color: '#4da3ff', icon: 'mdi:coffee' },
  { label: '关机', en: 'Shutdown', value: 13, color: '#9cb4d3', icon: 'mdi:power' },
  { label: '异常', en: 'Abnormal', value: 17, color: '#ff4d4d', icon: 'mdi:alert-circle' }
]
</script>

<style scoped>
.panel-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.status-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 12px 15px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.status-icon {
  font-size: 24px;
  margin-right: 15px;
  z-index: 1;
}

.status-info {
  flex: 1;
  z-index: 1;
}

.status-en {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.status-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.status-value {
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.num {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.status-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}
</style>
