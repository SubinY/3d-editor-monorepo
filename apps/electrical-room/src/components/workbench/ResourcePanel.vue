<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CatalogItem } from '@3d-editor/editor'
import type { AssetGroup } from './types'

const props = defineProps<{
  groups: AssetGroup[]
}>()

const emit = defineEmits<{
  'drag-start': [event: DragEvent, item: CatalogItem]
  'drag-end': []
}>()

const activeNames = ref<string[]>([])

watch(
  () => props.groups,
  groups => {
    activeNames.value = groups.map(g => g.key)
  },
  { immediate: true }
)
</script>

<template>
  <div class="resource-panel">
    <el-collapse v-model="activeNames" class="resource-collapse">
      <el-collapse-item v-for="group in groups" :key="group.key" :title="group.label" :name="group.key">
        <div v-if="group.items.length" class="resource-grid">
          <div
            v-for="item in group.items"
            :key="item.id + item.version"
            class="resource-item"
            draggable="true"
            @dragstart="emit('drag-start', $event, item)"
            @dragend="emit('drag-end')"
          >
            <div class="icon-box" :style="{ background: item.thumb ?? '#3f7fbf' }" />
            <span class="label">{{ item.name }}</span>
          </div>
        </div>
        <div v-else class="empty">暂无条目</div>
      </el-collapse-item>
    </el-collapse>

    <p class="hint">拖拽资源到 2D 画布放置；重叠位置会被碰撞检测拒绝。</p>
  </div>
</template>

<style scoped>
.resource-panel {
  height: 100%;
  overflow-y: auto;
  padding: 0 4px 12px;
}

.resource-collapse {
  border: none;
  --el-collapse-header-height: 40px;
  --el-collapse-header-bg-color: transparent;
  --el-collapse-content-bg-color: transparent;
  --el-collapse-border-color: #1d2c3e;
}

.resource-collapse :deep(.el-collapse-item__header) {
  color: #cfe0f0;
  font-size: 13px;
  padding: 0 8px;
  border-bottom-color: #1d2c3e;
}

.resource-collapse :deep(.el-collapse-item__header.is-active) {
  color: #4dabf7;
}

.resource-collapse :deep(.el-collapse-item__wrap) {
  border-bottom-color: #1d2c3e;
}

.resource-collapse :deep(.el-collapse-item__content) {
  padding: 8px 4px 12px;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 8px;
}

.resource-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: grab;
  user-select: none;
  padding: 4px;
  border-radius: 6px;
}

.resource-item:hover .icon-box {
  border-color: #4dabf7;
}

.icon-box {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  border: 1px solid #2c3e52;
  background: #131e2b;
  display: grid;
  place-items: center;
}

.label {
  font-size: 12px;
  color: #cfe0f0;
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  font-size: 12px;
  color: #44556b;
  padding: 4px 8px;
}

.hint {
  margin: 12px 8px 0;
  font-size: 12px;
  color: #4d6076;
  line-height: 1.6;
}
</style>
