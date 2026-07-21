<script setup lang="ts">
import { ref } from 'vue'
import type { ComponentSpec, PanelType } from '../types'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  components: ComponentSpec[]
}>()

const emit = defineEmits<{
  (e: 'spawn', id: string): void
  (e: 'dragstart', event: DragEvent, id: string): void
  (e: 'toggle-panel', id: PanelType): void
  (e: 'resize-floor', payload: { axis: 'x' | 'z'; delta: number }): void
}>()

type ViewLevel = 'main' | 'floor' | 'panel'
const currentLevel = ref<ViewLevel>('main')

function onDragStart(event: DragEvent, id: string) {
  emit('dragstart', event, id)
}

function handleBack() {
  currentLevel.value = 'main'
}

const panelButtons: { id: PanelType; title: string; icon: string }[] = [
  { id: 'production', title: '生产指标', icon: 'mdi:cog' },
  { id: 'operation', title: '运行指标', icon: 'mdi:gauge' },
  { id: 'environment', title: '环保指标', icon: 'mdi:leaf' }
]
</script>

<template>
  <footer class="bottom-bar">
    <div class="bar-content">
      <Transition name="slide-up" mode="out-in">
        <!-- Main Level -->
        <div v-if="currentLevel === 'main'" key="main" class="level-container">
          <div class="hex-grid">
            <div
              v-for="item in components"
              :key="item.id"
              class="hex-item"
              draggable="true"
              @dragstart="onDragStart($event, item.id)"
              @click="$emit('spawn', item.id)"
            >
              <div class="hex-inner" :style="{ '--color': item.color }">
                <Icon :icon="item.icon" class="hex-icon" />
                <span class="hex-label">{{ item.name }}</span>
              </div>
            </div>

            <!-- Floor Entry -->
            <div class="hex-item special" @click="currentLevel = 'floor'">
              <div class="hex-inner" style="--color: #ffcc00">
                <Icon icon="mdi:layers-outline" class="hex-icon" />
                <span class="hex-label">地板</span>
              </div>
            </div>

            <!-- Panel Entry -->
            <div class="hex-item special" @click="currentLevel = 'panel'">
              <div class="hex-inner" style="--color: #2de3a2">
                <Icon icon="mdi:view-dashboard-outline" class="hex-icon" />
                <span class="hex-label">面板</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Floor Resize Level -->
        <div v-else-if="currentLevel === 'floor'" key="floor" class="level-container">
          <div class="sub-actions">
            <button class="back-btn" @click="handleBack">
              <Icon icon="mdi:arrow-left" /> 返回
            </button>
            <div class="action-group">
              <button class="action-btn" @click="$emit('resize-floor', { axis: 'x', delta: -10 })">
                <Icon icon="mdi:arrow-collapse-horizontal" /> X 轴缩小
              </button>
              <button class="action-btn" @click="$emit('resize-floor', { axis: 'x', delta: 10 })">
                <Icon icon="mdi:arrow-expand-horizontal" /> X 轴扩大
              </button>
              <button class="action-btn" @click="$emit('resize-floor', { axis: 'z', delta: -10 })">
                <Icon icon="mdi:arrow-collapse-vertical" /> Y 轴缩小
              </button>
              <button class="action-btn" @click="$emit('resize-floor', { axis: 'z', delta: 10 })">
                <Icon icon="mdi:arrow-expand-vertical" /> Y 轴扩大
              </button>
            </div>
          </div>
        </div>

        <!-- Panel Toggle Level -->
        <div v-else-if="currentLevel === 'panel'" key="panel" class="level-container">
          <div class="sub-actions">
            <button class="back-btn" @click="handleBack">
              <Icon icon="mdi:arrow-left" /> 返回
            </button>
            <div class="action-group">
              <button
                v-for="btn in panelButtons"
                :key="btn.id"
                class="action-btn"
                @click="$emit('toggle-panel', btn.id)"
              >
                <Icon :icon="btn.icon" /> {{ btn.title }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </footer>
</template>

<style scoped>
.bottom-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 140px;
  background: linear-gradient(0deg, rgba(10, 20, 40, 0.95), transparent);
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: 20px;
  pointer-events: none;
}

.bar-content {
  width: 100%;
  max-width: 1200px;
  pointer-events: auto;
}

.level-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

/* Hexagon Grid */
.hex-grid {
  display: flex;
  gap: 15px;
  padding: 0 40px;
  overflow-x: auto;
  scrollbar-width: none;
}
.hex-grid::-webkit-scrollbar { display: none; }

.hex-item {
  width: 80px;
  height: 92px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.5));
}

.hex-item:hover {
  transform: translateY(-10px) scale(1.1);
}

.hex-inner {
  width: 100%;
  height: 100%;
  background: rgba(10, 30, 60, 0.7);
  backdrop-filter: blur(10px);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  position: relative;
  transition: all 0.3s;
}

.hex-inner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, var(--color), transparent);
  opacity: 0.3;
  pointer-events: none;
}

.hex-inner::after {
  content: '';
  position: absolute;
  inset: 1px;
  background: rgba(10, 20, 40, 0.9);
  clip-path: polygon(50% 0.5%, 99.5% 25.5%, 99.5% 74.5%, 50% 99.5%, 0.5% 74.5%, 0.5% 25.5%);
  z-index: -1;
}

.hex-item:hover .hex-inner {
  background: var(--color);
  box-shadow: 0 0 20px var(--color);
}

.hex-item:hover .hex-inner::after {
  background: rgba(10, 20, 40, 0.7);
}

.hex-icon {
  font-size: 28px;
  color: #fff;
  filter: drop-shadow(0 0 5px rgba(255,255,255,0.5));
}

.hex-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: bold;
}

.hex-item.special .hex-inner {
  background: rgba(255, 255, 255, 0.1);
}

/* Sub Actions */
.sub-actions {
  display: flex;
  align-items: center;
  gap: 30px;
  background: rgba(10, 25, 50, 0.8);
  padding: 15px 30px;
  border-radius: 50px;
  border: 1px solid rgba(77, 163, 255, 0.3);
  backdrop-filter: blur(15px);
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 8px 15px;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  transition: all 0.3s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.action-group {
  display: flex;
  gap: 15px;
}

.action-btn {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  transition: all 0.3s;
  opacity: 0.7;
}

.action-btn:hover {
  opacity: 1;
  transform: scale(1.1);
  color: #4da3ff;
}

.action-btn .iconify {
  font-size: 24px;
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.9);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-30px) scale(0.9);
}
</style>
