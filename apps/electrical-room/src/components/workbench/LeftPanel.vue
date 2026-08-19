<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Box, FolderOpened, Share } from '@element-plus/icons-vue'
import type { CatalogItem } from '@mh/3d-editor'
import type { AssetGroup, LayerTreeItem } from './types'
import ResourcePanel from './ResourcePanel.vue'
import LayerTreePanel from './LayerTreePanel.vue'

const props = defineProps<{
  systemGroups: AssetGroup[]
  mineItems: CatalogItem[]
  nodes: LayerTreeItem[]
  selectedId: string
}>()

const emit = defineEmits<{
  'drag-start': [event: DragEvent, item: CatalogItem]
  'drag-end': []
  'select-layer': [id: string]
  'toggle-visible': [id: string, visible: boolean]
  import: []
  'edit-draft': [item: CatalogItem]
  'delete-draft': [item: CatalogItem]
}>()

const activeTab = ref('system')

const mineGroups = computed<AssetGroup[]>(() => [
  { key: 'mine', label: '已导入', items: props.mineItems }
])

watch(
  () => props.mineItems.length,
  (len, prev) => {
    if (prev === 0 && len > 0) activeTab.value = 'mine'
  }
)
</script>

<template>
  <aside class="left-panel">
    <el-tabs v-model="activeTab" class="left-tabs" stretch>
      <el-tab-pane name="system">
        <template #label>
          <span class="tab-label">
            <el-icon><Box /></el-icon>
            系统资源
          </span>
        </template>
        <ResourcePanel
          mode="system"
          :groups="systemGroups"
          @drag-start="(e, item) => emit('drag-start', e, item)"
          @drag-end="emit('drag-end')"
        />
      </el-tab-pane>

      <el-tab-pane name="mine">
        <template #label>
          <span class="tab-label">
            <el-icon><FolderOpened /></el-icon>
            我的素材
          </span>
        </template>
        <ResourcePanel
          mode="mine"
          :groups="mineGroups"
          @drag-start="(e, item) => emit('drag-start', e, item)"
          @drag-end="emit('drag-end')"
          @import="emit('import')"
          @edit-draft="emit('edit-draft', $event)"
          @delete-draft="emit('delete-draft', $event)"
        />
      </el-tab-pane>

      <el-tab-pane name="layers">
        <template #label>
          <span class="tab-label">
            <el-icon><Share /></el-icon>
            图层
          </span>
        </template>
        <LayerTreePanel
          :nodes="nodes"
          :selected-id="selectedId"
          @select="emit('select-layer', $event)"
          @toggle-visible="(id, visible) => emit('toggle-visible', id, visible)"
        />
      </el-tab-pane>
    </el-tabs>
  </aside>
</template>

<style scoped>
.left-panel {
  width: 280px;
  background: #0e1621;
  border-right: 1px solid #1d2c3e;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.left-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  --el-tabs-header-height: 44px;
}

.left-tabs :deep(.el-tabs__header) {
  margin: 0;
  background: #101823;
  border-bottom: 1px solid #1d2c3e;
}

.left-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: #1d2c3e;
}

.left-tabs :deep(.el-tabs__item) {
  color: #7a8fa6;
  padding: 0 8px;
  height: 44px;
  font-size: 12px;
}

.left-tabs :deep(.el-tabs__item.is-active) {
  color: #e8f1fa;
}

.left-tabs :deep(.el-tabs__active-bar) {
  background-color: #4dabf7;
  height: 2px;
}

.left-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.left-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
</style>
