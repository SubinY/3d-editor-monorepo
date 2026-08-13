<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import type { Tool2D, TransformMode } from '@mh/3d-editor'

const props = defineProps<{
  mode?: 'editor' | 'runtime'
}>()

const emit = defineEmits<{
  'set-tool': [tool: Tool2D]
  'set-transform': [mode: TransformMode]
  undo: []
  redo: []
  save: []
  publish: []
  fit: []
}>()

const router = useRouter()
const store = useEditorStore()
const { projectName, tool, transformMode, canUndo, canRedo } = storeToRefs(store)

type ToolBtn = {
  key: string
  label: string
  icon: string
  active?: boolean
  disabled?: boolean
  action: () => void
}

const toolButtons: ToolBtn[] = [
  {
    key: 'select',
    label: '选择',
    icon: 'mdi:cursor-default-outline',
    action: () => emit('set-tool', 'select')
  },
  {
    key: 'wall',
    label: '墙体',
    icon: 'mdi:wall',
    action: () => emit('set-tool', 'wall')
  },
  {
    key: 'measure',
    label: '测量',
    icon: 'mdi:ruler',
    action: () => console.info('[toolbar] measure (占位)')
  },
  {
    key: 'align',
    label: '对齐',
    icon: 'mdi:align-horizontal-center',
    action: () => console.info('[toolbar] align (占位)')
  }
]

const transformButtons: ToolBtn[] = [
  {
    key: 'translate',
    label: '移动',
    icon: 'mdi:axis-arrow',
    action: () => emit('set-transform', 'translate')
  },
  {
    key: 'rotate',
    label: '旋转',
    icon: 'mdi:rotate-3d-variant',
    action: () => emit('set-transform', 'rotate')
  },
  {
    key: 'scale',
    label: '缩放',
    icon: 'mdi:resize',
    action: () => emit('set-transform', 'scale')
  }
]

function isToolActive(key: string) {
  return tool.value === key
}

function isTransformActive(key: string) {
  return transformMode.value === key && tool.value === 'select'
}

function goRuntime() {
  router.push('/runtime')
}

function goEditor() {
  router.push('/editor')
}
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <div class="logo">
        <Icon icon="mdi:crane" :width="22" :height="22" />
      </div>
      <div class="titles">
        <div class="name">PowerRoom Pro</div>
        <div class="sub">Electrical Room Digital Twin</div>
      </div>
      <div v-if="props.mode !== 'runtime'" class="project">
        <span class="label">项目名称:</span>
        <input v-model="projectName" class="project-input" />
        <Icon icon="mdi:pencil-outline" class="edit-icon" :width="16" :height="16" />
      </div>
    </div>

    <div v-if="props.mode !== 'runtime'" class="toolbar">
      <div class="group">
        <button
          v-for="btn in toolButtons"
          :key="btn.key"
          type="button"
          class="tool-btn"
          :class="{ active: isToolActive(btn.key) }"
          @click="btn.action"
        >
          <Icon :icon="btn.icon" :width="18" :height="18" />
          <span>{{ btn.label }}</span>
        </button>
      </div>
      <div class="divider" />
      <div class="group">
        <button
          v-for="btn in transformButtons"
          :key="btn.key"
          type="button"
          class="tool-btn"
          :class="{ active: isTransformActive(btn.key) }"
          @click="btn.action"
        >
          <Icon :icon="btn.icon" :width="18" :height="18" />
          <span>{{ btn.label }}</span>
        </button>
      </div>
      <div class="divider" />
      <div class="group">
        <button type="button" class="tool-btn" :disabled="!canUndo" @click="emit('undo')">
          <Icon icon="mdi:undo" :width="18" :height="18" />
          <span>撤销</span>
        </button>
        <button type="button" class="tool-btn" :disabled="!canRedo" @click="emit('redo')">
          <Icon icon="mdi:redo" :width="18" :height="18" />
          <span>重做</span>
        </button>
      </div>
      <div class="divider" />
      <div class="group">
        <button type="button" class="tool-btn" @click="emit('save')">
          <Icon icon="mdi:content-save-outline" :width="18" :height="18" />
          <span>保存</span>
        </button>
        <button type="button" class="tool-btn" @click="emit('publish')">
          <Icon icon="mdi:cloud-upload-outline" :width="18" :height="18" />
          <span>发布</span>
        </button>
        <button type="button" class="tool-btn" @click="goRuntime">
          <Icon icon="mdi:monitor-dashboard" :width="18" :height="18" />
          <span>监控</span>
        </button>
      </div>
    </div>

    <div v-else class="toolbar runtime-actions">
      <button type="button" class="link-btn" @click="goEditor">
        <Icon icon="mdi:pencil-ruler" :width="18" :height="18" />
        进入编辑器
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 14px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent-dim);
  color: var(--accent);
  display: grid;
  place-items: center;
}

.titles .name {
  font-size: 14px;
  font-weight: 700;
  color: var(--info);
  line-height: 1.1;
}

.titles .sub {
  font-size: 11px;
  color: var(--text-muted);
}

.project {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 16px;
  padding-left: 16px;
  border-left: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 12px;
}

.project-input {
  width: 220px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  padding: 0 8px;
}

.project-input:hover,
.project-input:focus {
  outline: none;
  border-color: var(--border-strong);
  background: var(--bg-elevated);
}

.edit-icon {
  color: var(--text-muted);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.divider {
  width: 1px;
  height: 28px;
  background: var(--border-subtle);
  margin: 0 6px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 48px;
  height: 44px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
}

.tool-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tool-btn.active {
  background: var(--accent-dim);
  color: var(--accent);
}

.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}
</style>
