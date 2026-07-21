<template>
  <div class="scene-editor-page">
    <SceneToolbar />
    <div class="editor-body">
      <SceneAssetSidebar />
      <SceneViewport />
      <SceneRightPanel />
    </div>
    <footer class="status-bar">
      <span class="status-item">
        <Icon icon="mdi:cube-outline" class="status-icon" />
        实例：{{ instanceCount }}
      </span>
      <span class="status-item">
        <Icon icon="mdi:cursor-default-click" class="status-icon" />
        选中：{{ editor.selectedIds.value.length }}
      </span>
      <span class="status-item">
        <Icon icon="mdi:tools" class="status-icon" />
        {{ toolLabel }}
      </span>
      <span class="status-item floor-info">
        <Icon icon="mdi:floor-plan" class="status-icon" />
        {{ editor.floorWidth.value }}m × {{ editor.floorDepth.value }}m
      </span>
      <span class="status-item" v-if="editor.currentSceneId.value">
        <Icon icon="mdi:content-save-outline" class="status-icon saved" />
        已保存
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
      <span class="status-item hint">
        从左侧拖入资产 · 双击/Alt+点击钻取 · G 移动 · R 旋转 · S 缩放 · Delete 删除
      </span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { createSceneEditor } from './composables/useSceneEditor'
import SceneToolbar from './components/SceneToolbar.vue'
import SceneAssetSidebar from './components/SceneAssetSidebar.vue'
import SceneViewport from './components/SceneViewport.vue'
import SceneRightPanel from './components/SceneRightPanel.vue'

const route = useRoute()
const editor = createSceneEditor()

const instanceCount = computed(() => editor.sceneTree.value.length)

const toolLabels: Record<string, string> = { translate: '移动', rotate: '旋转', scale: '缩放' }
const toolLabel = computed(() => toolLabels[editor.currentTool.value] || '移动')

onMounted(() => {
  const sceneId = route.query.id as string | undefined
  if (sceneId) {
    setTimeout(() => { void editor.loadScene(sceneId) }, 500)
  }
})
</script>

<style scoped>
.scene-editor-page {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: var(--color-bg);
  overflow: hidden;
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
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
  color: var(--color-accent);
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

.status-spacer { flex: 1; }
.status-item.hint { letter-spacing: 0.3px; }
</style>
