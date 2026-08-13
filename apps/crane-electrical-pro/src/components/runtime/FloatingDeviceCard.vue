<script setup lang="ts">
import { computed } from 'vue'
import type { RuntimeDevice } from '@/stores/runtime'
import { DEVICE_STATUS_META } from '@/utils/visual-state-map'

const props = defineProps<{
  device: RuntimeDevice | null
  updatedAt: string
}>()

const meta = computed(() =>
  props.device ? DEVICE_STATUS_META[props.device.status] : null
)
</script>

<template>
  <div v-if="device && meta" class="floating-card">
    <div class="head">
      <div class="title">#{{ device.code }} {{ device.name }}</div>
      <div class="status">
        <span class="dot" :style="{ background: meta.color }" />
        {{ meta.runLabel }}
      </div>
    </div>
    <div class="grid">
      <div class="cell">
        <div class="k">电压</div>
        <div class="v">{{ device.voltage.toFixed(1) }} V</div>
      </div>
      <div class="cell">
        <div class="k">电流</div>
        <div class="v">{{ device.current.toFixed(1) }} A</div>
      </div>
      <div class="cell">
        <div class="k">温度</div>
        <div class="v">{{ device.temperature.toFixed(1) }} °C</div>
      </div>
      <div class="cell">
        <div class="k">状态</div>
        <div class="v" :style="{ color: meta.color }">{{ meta.label }}</div>
      </div>
    </div>
    <div class="foot">更新时间: {{ updatedAt.split(' ').pop() }}</div>
  </div>
</template>

<style scoped>
.floating-card {
  position: absolute;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  width: 280px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(17, 24, 39, 0.92);
  border: 1px solid var(--border-strong);
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  z-index: 5;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.title {
  font-size: 13px;
  font-weight: 600;
}

.status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cell {
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-app);
}

.k {
  font-size: 10px;
  color: var(--text-muted);
}

.v {
  font-size: 14px;
  font-weight: 600;
  margin-top: 2px;
}

.foot {
  margin-top: 10px;
  font-size: 10px;
  color: var(--text-muted);
}
</style>
