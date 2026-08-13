<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import AppHeader from './AppHeader.vue'
import StatusBar from './StatusBar.vue'
import type { Tool2D, TransformMode } from '@mh/3d-editor'

const store = useEditorStore()
const { leftCollapsed, rightCollapsed, leftTab, rightTab } = storeToRefs(store)

const emit = defineEmits<{
  'set-tool': [tool: Tool2D]
  'set-transform': [mode: TransformMode]
  undo: []
  redo: []
  save: []
  publish: []
  fit: []
}>()

function toggleLeft() {
  leftCollapsed.value = !leftCollapsed.value
}

function toggleRight() {
  rightCollapsed.value = !rightCollapsed.value
}
</script>

<template>
  <div class="main-layout">
    <AppHeader
      mode="editor"
      @set-tool="emit('set-tool', $event)"
      @set-transform="emit('set-transform', $event)"
      @undo="emit('undo')"
      @redo="emit('redo')"
      @save="emit('save')"
      @publish="emit('publish')"
      @fit="emit('fit')"
    />

    <div class="body">
      <aside class="left-panel" :class="{ collapsed: leftCollapsed }">
        <div class="panel-tabs">
          <button
            v-if="!leftCollapsed"
            type="button"
            :class="{ active: leftTab === 'resource' }"
            @click="leftTab = 'resource'"
          >
            资源库
          </button>
          <button
            v-if="!leftCollapsed"
            type="button"
            :class="{ active: leftTab === 'outline' }"
            @click="leftTab = 'outline'"
          >
            图层结构
          </button>
          <button type="button" class="collapse-btn" :title="leftCollapsed ? '展开' : '折叠'" @click="toggleLeft">
            <Icon
              :icon="leftCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'"
              :width="16"
              :height="16"
            />
          </button>
        </div>
        <!-- 参考图：资源在上、图层在下同屏；Tab 仅切换滚动焦点区高亮 -->
        <div v-show="!leftCollapsed" class="panel-body stacked">
          <div class="stack-block" :class="{ dim: leftTab !== 'resource' }">
            <slot name="left-resource" />
          </div>
          <div class="stack-block outline-block" :class="{ dim: leftTab !== 'outline' }">
            <div class="stack-label">图层结构</div>
            <slot name="left-outline" />
          </div>
        </div>
      </aside>

      <section class="center">
        <slot name="viewport" />
      </section>

      <aside class="right-panel" :class="{ collapsed: rightCollapsed }">
        <div class="panel-tabs">
          <button
            v-if="!rightCollapsed"
            type="button"
            :class="{ active: rightTab === 'property' }"
            @click="rightTab = 'property'"
          >
            属性
          </button>
          <button
            v-if="!rightCollapsed"
            type="button"
            :class="{ active: rightTab === 'scene' }"
            @click="rightTab = 'scene'"
          >
            场景
          </button>
          <button
            v-if="!rightCollapsed"
            type="button"
            :class="{ active: rightTab === 'data' }"
            @click="rightTab = 'data'"
          >
            数据
          </button>
          <button
            type="button"
            class="collapse-btn"
            :title="rightCollapsed ? '展开' : '折叠'"
            @click="toggleRight"
          >
            <Icon
              :icon="rightCollapsed ? 'mdi:chevron-left' : 'mdi:chevron-right'"
              :width="16"
              :height="16"
            />
          </button>
        </div>
        <div v-show="!rightCollapsed" class="panel-body">
          <div v-show="rightTab === 'property'" class="fill">
            <slot name="right-property" />
          </div>
          <div v-show="rightTab === 'scene'" class="fill">
            <slot name="right-scene" />
          </div>
          <div v-show="rightTab === 'data'" class="fill">
            <slot name="right-data" />
          </div>
        </div>
      </aside>
    </div>

    <StatusBar />
  </div>
</template>

<style scoped>
.main-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.left-panel,
.right-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  flex-shrink: 0;
  transition: width 0.18s ease;
}

.left-panel {
  width: var(--left-w);
  border-right: 1px solid var(--border-subtle);
}

.left-panel.collapsed {
  width: var(--left-collapsed-w);
}

.right-panel {
  width: var(--right-w);
  border-left: 1px solid var(--border-subtle);
}

.right-panel.collapsed {
  width: var(--left-collapsed-w);
}

.panel-tabs {
  height: 36px;
  display: flex;
  align-items: flex-end;
  gap: 0;
  padding: 0 8px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.panel-tabs button {
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
}

.panel-tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: transparent;
}

.collapse-btn {
  margin-left: auto !important;
  width: 28px;
  padding: 0 !important;
  border-bottom: 0 !important;
  color: var(--text-muted) !important;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.panel-body.stacked {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stack-block {
  flex: 1;
  min-height: 140px;
  overflow: auto;
  border-bottom: 1px solid var(--border-subtle);
  transition: opacity 0.15s ease;
}

.stack-block.dim {
  opacity: 0.55;
}

.outline-block {
  flex: 1.2;
  border-bottom: 0;
}

.stack-label {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 10px 4px;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-panel);
}

.fill {
  height: 100%;
}

.center {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--scene-bg);
}
</style>
