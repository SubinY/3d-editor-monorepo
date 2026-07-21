<template>
  <div class="asset-editor-page">
    <EditorToolbar />

    <div class="mode-switch-bar">
      <button class="mode-btn" :class="{ active: editor.mode.value === '2d' }" @click="switchMode('2d')">
        <Icon icon="mdi:grid" />
        <span>2D排布</span>
      </button>
      <button class="mode-btn" :class="{ active: editor.mode.value === '3d' }" @click="switchMode('3d')">
        <Icon icon="mdi:cube-outline" />
        <span>3D派生预览</span>
      </button>
    </div>

    <div class="editor-body">
      <ComponentLibrary />
      <div class="canvas-slot">
        <Layout2DCanvas :class="{ hidden: editor.mode.value !== '2d' }" />
        <EditorViewport :class="{ hidden: editor.mode.value !== '3d' }" />
      </div>
      <Layout2DPanel v-if="editor.mode.value === '2d'" />
      <PropertyPanel v-else />
    </div>

    <footer class="status-bar">
      <span class="status-item">
        <Icon icon="mdi:cube-outline" class="status-icon" />
        {{ editor.mode.value === '2d' ? '排布项' : '对象' }}：{{ objectCount }}
      </span>
      <span class="status-item">
        <Icon icon="mdi:cursor-default-click" class="status-icon" />
        选中：{{ editor.mode.value === '2d' ? (editor.selectedLayoutItemId.value ? 1 : 0) : editor.selectedIds.value.length }}
      </span>
      <span class="status-item">
        <Icon icon="mdi:tools" class="status-icon" />
        {{ editor.mode.value === '2d' ? '2D排布编辑' : '3D派生只读预览' }}
      </span>
      <span class="status-item" v-if="editor.currentAssetId.value">
        <Icon icon="mdi:content-save-outline" class="status-icon saved" />
        {{ editor.currentAssetName.value }}
      </span>
      <span class="status-item drill" v-if="editor.drillActive.value">
        <Icon icon="mdi:magnify-plus-outline" class="status-icon warn" />
        钻取中：{{ editor.drillTargetName.value || '对象' }}（只读）
        <button class="drill-exit-btn" @click="editor.exitDrill()">退出</button>
      </span>
      <span class="status-item notice" v-if="editor.notice.value">
        <Icon icon="mdi:information-outline" class="status-icon warn" />
        {{ editor.notice.value.message }}
      </span>
      <span class="status-spacer" />
      <span class="status-item hint">{{ hintText }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { Icon } from '@iconify/vue'
import { createAssetEditor } from './composables/useAssetEditor'
import type { AssetEditorMode } from './types'
import EditorToolbar from './components/EditorToolbar.vue'
import ComponentLibrary from './components/ComponentLibrary.vue'
import EditorViewport from './components/EditorViewport.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import Layout2DCanvas from './components/Layout2DCanvas.vue'
import Layout2DPanel from './components/Layout2DPanel.vue'

const route = useRoute()
const router = useRouter()
const editor = createAssetEditor()

const objectCount = computed(() =>
  editor.mode.value === '2d' ? editor.layoutItems.value.length : editor.sceneTree.value.length
)

const hintText = computed(() =>
  editor.mode.value === '2d'
    ? '从左侧添加元器件，拖拽2D面板进行排布；切到3D查看派生结果。'
    : '3D派生预览只读：Alt+双击钻取查看细节，Esc或按钮退出钻取。'
)

onMounted(() => {
  const assetId = route.query.id as string | undefined
  if (assetId) {
    const doLoad = (retries = 60) => {
      if (editor.ctx.value) {
        void editor.loadAsset(assetId)
      } else if (retries > 0) {
        setTimeout(() => doLoad(retries - 1), 100)
      }
    }
    setTimeout(() => doLoad(), 150)
    return
  }

  const cabinetComponentId = route.query.cabinetComponentId as string | undefined
  if (cabinetComponentId) {
    const doCreate = (retries = 60) => {
      if (editor.ctx.value) {
        void editor.createNewWithCabinet(cabinetComponentId)
      } else if (retries > 0) {
        setTimeout(() => doCreate(retries - 1), 100)
      }
    }
    setTimeout(() => doCreate(), 150)
    return
  }

  alert('新建资产前请先选择机柜。')
  router.push('/asset-library')
})

onBeforeRouteLeave((_to, _from, next) => {
  if (route.query.from === 'scene' && editor.hasUnsavedChanges.value) {
    if (confirm('存在未保存的更改，确定离开吗？')) next()
    else next(false)
  } else {
    next()
  }
})

function switchMode(nextMode: AssetEditorMode) {
  void editor.setMode(nextMode)
}
</script>

<style scoped>
.asset-editor-page {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: var(--color-bg);
  overflow: hidden;
}

.mode-switch-bar {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.mode-btn:hover {
  border-color: var(--color-border-active);
  color: var(--color-text);
}

.mode-btn.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-dim);
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.canvas-slot {
  position: relative;
  flex: 1;
  min-height: 0;
}

.canvas-slot > * {
  position: absolute;
  inset: 0;
}

.canvas-slot > .hidden {
  visibility: hidden;
  pointer-events: none;
}

.status-bar {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 16px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  font-size: 11px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-icon {
  font-size: 13px;
  color: var(--color-primary);
  opacity: 0.6;
}

.status-icon.saved {
  color: var(--color-accent);
  opacity: 1;
}

.status-icon.warn {
  color: #f5a623;
  opacity: 1;
}

.status-item.drill {
  color: #f5a623;
}

.status-item.notice {
  color: rgba(245, 166, 35, 0.95);
}

.drill-exit-btn {
  margin-left: 6px;
  border: 1px solid rgba(245, 166, 35, 0.4);
  background: rgba(245, 166, 35, 0.12);
  color: #f5a623;
  border-radius: 4px;
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
}

.drill-exit-btn:hover {
  background: rgba(245, 166, 35, 0.2);
}

.status-spacer {
  flex: 1;
}

.status-item.hint {
  letter-spacing: 0.3px;
}
</style>
