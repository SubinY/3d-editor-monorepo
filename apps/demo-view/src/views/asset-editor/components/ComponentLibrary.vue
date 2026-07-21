<template>
  <aside class="component-library">
    <div class="panel-header">
      <Icon icon="mdi:puzzle-outline" class="header-icon" />
      <span>元器件库</span>
    </div>

    <div class="search-box">
      <Icon icon="mdi:magnify" class="search-icon" />
      <input
        v-model="searchText"
        type="text"
        placeholder="搜索元器件..."
        class="search-input"
      />
    </div>

    <div v-if="filteredCategories.length === 0" class="empty-state">
      <Icon icon="mdi:package-variant-closed-remove" class="empty-icon" />
      <p>暂无可用元器件</p>
      <p class="empty-tip">请先在资产库导入组件或等待首次种子资源初始化完成。</p>
    </div>

    <div v-for="cat in filteredCategories" :key="cat.key" class="category">
      <div class="category-label">{{ cat.label }}</div>
      <div class="parts-grid">
        <div
          v-for="part in cat.parts"
          :key="part.id"
          class="part-card"
          draggable="true"
          @dragstart="onDragStart($event, part.id)"
          @click="onClickSpawn(part.id)"
        >
          <div class="part-swatch" :style="{ background: part.color }" />
          <Icon :icon="part.icon" class="part-icon" :style="{ color: part.color }" />
          <span class="part-name">{{ part.name }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useAssetEditor } from '../composables/useAssetEditor'

const editor = useAssetEditor()
const searchText = ref('')

const categoryLabels: Record<string, string> = {
  structure: '结构件',
  electrical: '电气元件',
  auxiliary: '辅助件',
  imported: '导入组件'
}

const filteredCategories = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  const order = ['structure', 'electrical', 'auxiliary', 'imported'] as const
  return order
    .map(key => ({
      key,
      label: categoryLabels[key],
      parts: editor.partSpecs.value
        .filter(p => p.category === key)
        .filter(p => !q || p.name.toLowerCase().includes(q) || p.id.includes(q))
    }))
    .filter(c => c.parts.length > 0)
})

function onDragStart(event: DragEvent, partId: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('part-id', partId)
  event.dataTransfer.dropEffect = 'copy'
}

function onClickSpawn(partId: string) {
  editor.spawn(partId)
}
</script>

<style scoped>
.component-library {
  width: 240px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.header-icon {
  font-size: 16px;
  color: var(--color-primary);
}

.search-box {
  position: relative;
  padding: 10px 12px;
}

.search-icon {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 7px 8px 7px 30px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--color-border-active);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 28px;
  opacity: 0.5;
}

.empty-state p {
  margin: 6px 0 0;
  font-size: 12px;
}

.empty-tip {
  font-size: 11px;
  line-height: 1.45;
}

.category {
  padding: 0 12px;
}

.category-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  padding: 10px 0 6px;
}

.parts-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.part-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  position: relative;
  overflow: hidden;
  transition: background var(--transition-fast);
}

.part-card:hover {
  background: var(--color-primary-dim);
}

.part-swatch {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.part-card:hover .part-swatch {
  opacity: 1;
}

.part-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.part-name {
  font-size: 12px;
  color: var(--color-text-secondary);
  transition: color var(--transition-fast);
}

.part-card:hover .part-name {
  color: var(--color-text);
}
</style>
