<script setup lang="ts">
defineProps<{
  title: string
  value: string
  sub: string
  color: string
  icon: string
}>()
</script>

<template>
  <div class="metric-card">
    <div class="top">
      <div>
        <div class="title">{{ title }}</div>
        <div class="value" :style="{ color }">{{ value }}</div>
        <div class="sub">{{ sub }}</div>
      </div>
      <div class="icon" :style="{ color, background: color + '22' }">
        <slot name="icon" />
      </div>
    </div>
    <svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none">
      <polyline
        fill="none"
        :stroke="color"
        stroke-width="2"
        points="0,18 12,14 24,16 36,10 48,12 60,8 72,11 84,6 100,9"
      />
    </svg>
  </div>
</template>

<style scoped>
.metric-card {
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
}

.top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.title {
  font-size: 11px;
  color: var(--text-muted);
}

.value {
  font-size: 20px;
  font-weight: 700;
  margin-top: 2px;
}

.sub {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

.icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.spark {
  width: 100%;
  height: 24px;
  margin-top: 8px;
  opacity: 0.85;
}
</style>
