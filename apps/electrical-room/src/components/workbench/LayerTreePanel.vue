<script setup lang="ts">
import { View, Hide } from '@element-plus/icons-vue'
import type { LayerTreeItem } from './types'

defineProps<{
  nodes: LayerTreeItem[]
  selectedId: string
}>()

const emit = defineEmits<{
  select: [id: string]
  'toggle-visible': [id: string, visible: boolean]
}>()

function onNodeClick(data: LayerTreeItem) {
  emit('select', data.selectId)
}

function onToggleVisible(event: MouseEvent, data: LayerTreeItem) {
  event.stopPropagation()
  if (!data.editable) return
  emit('toggle-visible', data.selectId, !data.visible)
}
</script>

<template>
  <div class="layer-panel">
    <el-tree
      v-if="nodes.length"
      :data="nodes"
      node-key="id"
      :current-node-key="selectedId || undefined"
      highlight-current
      default-expand-all
      :expand-on-click-node="false"
      @node-click="onNodeClick"
    >
      <template #default="{ data }">
        <div
          class="tree-row"
          :class="{ hidden: !data.visible, projection: !data.editable }"
        >
          <span class="tree-main">
            <span class="tree-name">{{ data.name }}</span>
            <span class="tree-id">{{ data.displayId }}</span>
          </span>
          <el-icon
            v-if="data.editable"
            class="vis-btn"
            :title="data.visible ? '隐藏' : '显示'"
            @click="onToggleVisible($event, data)"
          >
            <View v-if="data.visible" />
            <Hide v-else />
          </el-icon>
        </div>
      </template>
    </el-tree>
    <el-empty v-else description="暂无节点，从资源拖入" :image-size="64" />
  </div>
</template>

<style scoped>
.layer-panel {
  height: 100%;
  overflow-y: auto;
  padding: 8px 4px 12px;
}

.layer-panel :deep(.el-tree) {
  background: transparent;
  color: #cfe0f0;
  --el-tree-node-hover-bg-color: #16212e;
  --el-tree-text-color: #cfe0f0;
}

.layer-panel :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: rgba(31, 111, 235, 0.25);
  color: #fff;
}

.layer-panel :deep(.el-tree-node__content) {
  height: 36px;
  border-radius: 4px;
  padding-right: 8px;
}

.tree-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding-right: 2px;
}

.tree-row.hidden .tree-name {
  opacity: 0.4;
}

.tree-row.projection .tree-name {
  color: #8ea4bd;
}

.tree-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.tree-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-id {
  font-size: 10px;
  color: #5d7188;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vis-btn {
  flex-shrink: 0;
  font-size: 15px;
  color: #7a8fa6;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
}

.vis-btn:hover {
  color: #e8f1fa;
  background: #1d2a3a;
}

.layer-panel :deep(.el-empty__description) {
  color: #5d7188;
}
</style>
