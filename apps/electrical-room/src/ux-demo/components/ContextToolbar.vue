<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  move: []
  rotate: []
  duplicate: []
  delete: []
}>()
</script>

<template>
  <div v-if="visible" class="ctx">
    <button type="button" title="移动" @click="emit('move')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M12 3v18M3 12h18M7 7l-4 5 4 5M17 7l4 5-4 5M7 17l5 4 5-4M7 7l5-4 5 4" />
      </svg>
    </button>
    <button type="button" title="旋转" @click="emit('rotate')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M20 12a8 8 0 1 1-2.3-5.6" />
        <path d="M20 4v5h-5" />
      </svg>
    </button>
    <button type="button" title="复制" @click="emit('duplicate')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="8" y="8" width="11" height="11" rx="1.5" />
        <path d="M5 15V5h10" />
      </svg>
    </button>
    <button type="button" class="danger" title="删除" @click="emit('delete')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.ctx {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 7px;
  background: rgba(12, 18, 28, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  z-index: 8;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
}
button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #d5e0ec;
  cursor: pointer;
  display: grid;
  place-items: center;
}
button:hover {
  background: rgba(31, 111, 255, 0.35);
}
button.danger:hover {
  background: rgba(185, 28, 28, 0.55);
}
</style>
