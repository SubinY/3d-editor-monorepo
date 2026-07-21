<template>
  <header class="top-header">
    <div class="header-left">
      <div class="logo">
        <div class="logo-inner">T</div>
      </div>
      <div class="title-bar">
        <span class="title-text">HT-智慧工厂编辑器</span>
        <div class="title-bg"></div>
      </div>
    </div>

    <nav class="action-btns">
      <button
        v-for="btn in buttons"
        :key="btn.id"
        class="action-btn"
        :title="btn.tooltip"
        @click="btn.onClick"
      >
        <span class="icon"><Icon :icon="btn.icon" /></span>
        <span class="label">{{ btn.label }}</span>
      </button>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  onNew: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
}>()

const buttons = [
  { id: 'new', label: '新建', icon: 'mdi:file-outline', tooltip: '新建场景', onClick: () => props.onNew() },
  { id: 'save', label: '保存', icon: 'mdi:content-save-outline', tooltip: '保存场景', onClick: () => props.onSave() },
  { id: 'cancel', label: '取消', icon: 'mdi:close-circle-outline', tooltip: '取消操作', onClick: () => props.onUndo() }
]
</script>

<style scoped>
.top-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  z-index: 100;
  pointer-events: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
  pointer-events: auto;
}

.logo {
  width: 48px;
  height: 48px;
  background: radial-gradient(circle, #4da3ff, #1a56b3);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(77, 163, 255, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.logo-inner {
  font-size: 28px;
  font-weight: 900;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.title-bar {
  position: relative;
  height: 40px;
  padding: 0 20px;
  display: flex;
  align-items: center;
}

.title-text {
  font-size: 20px;
  font-weight: bold;
  font-style: italic;
  color: #fff;
  z-index: 1;
  text-shadow: 0 0 10px rgba(77, 163, 255, 0.8);
}

.title-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(77, 163, 255, 0.3), transparent);
  clip-path: polygon(0 0, 100% 0, 85% 100%, 0% 100%);
  border-left: 3px solid #4da3ff;
}

.action-btns {
  display: flex;
  gap: 20px;
  margin-left: 40px;
  pointer-events: auto;
}

.action-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s;
  padding: 8px 12px;
  border-radius: 4px;
}

.action-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.action-btn .icon {
  font-size: 20px;
}

.action-btn .label {
  font-size: 16px;
  font-weight: 500;
}
</style>
