<script setup lang="ts">
defineProps<{
  items: Array<{ id: string; label: string }>
  x: number
  y: number
}>()

const emit = defineEmits<{
  pick: [id: string]
  dismiss: []
}>()
</script>

<template>
  <div class="pick-layer" @pointerdown.self="emit('dismiss')">
    <div
      class="pick-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @pointerdown.stop
    >
      <div class="pick-title">选择物体</div>
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="pick-item"
        @click="emit('pick', item.id)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pick-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
}

.pick-menu {
  position: absolute;
  min-width: 140px;
  max-width: 220px;
  padding: 6px;
  background: rgba(12, 18, 28, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
}

.pick-title {
  padding: 4px 8px 6px;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: #7a8fa5;
}

.pick-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #d5e0ec;
  font-size: 13px;
  cursor: pointer;
}

.pick-item:hover {
  background: rgba(57, 210, 255, 0.12);
  color: #39d2ff;
}
</style>
