<script setup lang="ts">
import { ref } from 'vue'
import { Setting, Monitor } from '@element-plus/icons-vue'
import type { EnvironmentJSON, WallJSON } from '@3d-editor/editor'
import type { ViewMode } from './types'
import PropertyPanel from './PropertyPanel.vue'
import EnvironmentPanel from './EnvironmentPanel.vue'
import type { LiveCameraPose } from './EnvironmentPanel.vue'
import type { BoundsForm, SelectedNodeForm } from './PropertyPanel.vue'

defineProps<{
  isScene: boolean
  boundsForm: BoundsForm
  selectedNode: SelectedNodeForm
  selectedWall: WallJSON | null
  environment: EnvironmentJSON | null
  viewMode: ViewMode
  liveCameraPose?: LiveCameraPose | null
}>()

const emit = defineEmits<{
  'update:bounds': []
  'update:name': []
  'update:transform': []
  remove: []
  'apply-environment': [env: EnvironmentJSON]
}>()

const activeTab = ref('props')
</script>

<template>
  <aside class="right-panel">
    <el-tabs v-model="activeTab" class="right-tabs" stretch>
      <el-tab-pane name="props">
        <template #label>
          <span class="tab-label">
            <el-icon><Setting /></el-icon>
            属性
          </span>
        </template>
        <PropertyPanel
          :is-scene="isScene"
          :bounds-form="boundsForm"
          :selected-node="selectedNode"
          :selected-wall="selectedWall"
          @update:bounds="emit('update:bounds')"
          @update:name="emit('update:name')"
          @update:transform="emit('update:transform')"
          @remove="emit('remove')"
        />
      </el-tab-pane>

      <el-tab-pane name="scene">
        <template #label>
          <span class="tab-label">
            <el-icon><Monitor /></el-icon>
            场景
          </span>
        </template>
        <EnvironmentPanel
          v-if="environment"
          :environment="environment"
          :view-mode="viewMode"
          :is-scene="isScene"
          :live-camera-pose="liveCameraPose"
          @apply="emit('apply-environment', $event)"
        />
        <el-empty v-else description="编辑器未就绪" :image-size="48" />
      </el-tab-pane>
    </el-tabs>
  </aside>
</template>

<style scoped>
.right-panel {
  width: 340px;
  background: #0e1621;
  border-left: 1px solid #1d2c3e;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.right-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  --el-tabs-header-height: 44px;
}

.right-tabs :deep(.el-tabs__header) {
  margin: 0;
  background: #101823;
  border-bottom: 1px solid #1d2c3e;
}

.right-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: #1d2c3e;
}

.right-tabs :deep(.el-tabs__item) {
  color: #7a8fa6;
  padding: 0 12px;
  height: 44px;
}

.right-tabs :deep(.el-tabs__item.is-active) {
  color: #e8f1fa;
}

.right-tabs :deep(.el-tabs__active-bar) {
  background-color: #4dabf7;
  height: 2px;
}

.right-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.right-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow-y: auto;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
</style>
