<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Delete, Edit } from '@element-plus/icons-vue'
import type { CatalogItem } from '@mh/3d-editor'
import type { AssetGroup } from './types'

const props = defineProps<{
  mode: 'system' | 'mine'
  groups: AssetGroup[]
}>()

const emit = defineEmits<{
  'drag-start': [event: DragEvent, item: CatalogItem]
  'drag-end': []
  import: []
  'edit-draft': [item: CatalogItem]
  'delete-draft': [item: CatalogItem]
}>()

const activeNames = ref<string[]>([])

watch(
  () => props.groups,
  groups => {
    activeNames.value = groups.map(g => g.key)
  },
  { immediate: true }
)

function thumbStyle(item: CatalogItem): Record<string, string> {
  const thumb = item.thumb
  if (thumb && (thumb.startsWith('http') || thumb.startsWith('/') || thumb.startsWith('data:'))) {
    return {
      backgroundImage: `url(${thumb})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return { background: thumb ?? '#3f7fbf' }
}
</script>

<template>
  <div class="resource-panel">
    <div v-if="mode === 'mine'" class="toolbar">
      <el-button type="primary" size="small" :icon="Plus" @click="emit('import')">导入模型</el-button>
    </div>

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
            <div class="icon-box" :style="thumbStyle(item)">
              <div v-if="mode === 'mine'" class="item-actions" @mousedown.stop @click.stop>
                <button type="button" title="再编辑" @click="emit('edit-draft', item)">
                  <el-icon><Edit /></el-icon>
                </button>
                <button type="button" title="删除" @click="emit('delete-draft', item)">
                  <el-icon><Delete /></el-icon>
                </button>
              </div>
            </div>
            <span class="label">{{ item.name }}</span>
          </div>
        </div>
        <div v-else class="empty">{{ mode === 'mine' ? '暂无导入，点击上方导入模型' : '暂无条目' }}</div>
      </el-collapse-item>
    </el-collapse>

    <p class="hint">
      {{
        mode === 'mine'
          ? '拖到 2D 放置；导入/生成的草稿不进系统默认盘。'
          : '拖到 2D 放置；重叠位置会被碰撞检测拒绝。'
      }}
    </p>
  </div>
</template>

<style scoped>
.resource-panel {
  height: 100%;
  overflow-y: auto;
  padding: 0 4px 12px;
}

.toolbar {
  padding: 8px 8px 4px;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 6px;
}

.resource-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: grab;
  user-select: none;
  padding: 4px 2px;
  border-radius: 6px;
  min-width: 0;
  width: 100%;
}

.resource-item:hover .icon-box {
  border-color: #4dabf7;
}

.resource-item:hover .item-actions {
  opacity: 1;
}

.icon-box {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid #2c3e52;
  background: #131e2b;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.item-actions {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 2px;
  padding: 2px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.45), transparent 60%);
  opacity: 0;
  transition: opacity 0.15s;
}

.item-actions button {
  border: none;
  background: rgba(14, 22, 33, 0.8);
  color: #cfe0f0;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
}

.item-actions button:hover {
  color: #4dabf7;
}

.label {
  font-size: 11px;
  color: #cfe0f0;
  text-align: center;
  line-height: 1.35;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  word-break: break-all;
  overflow-wrap: anywhere;
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
