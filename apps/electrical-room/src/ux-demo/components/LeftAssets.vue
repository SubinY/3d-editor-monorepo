<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, Upload, MagicStick } from '@element-plus/icons-vue'
import type { CatalogItem } from '@3d-editor/editor'
import { UX_CATEGORY_META } from '../catalog'

const props = defineProps<{
  items: CatalogItem[]
}>()

const emit = defineEmits<{
  upload: []
  'ai-image': []
  'drag-start': [item: CatalogItem, event: DragEvent]
  'drag-end': []
}>()

const query = ref('')
const activeCat = ref<string>('equipment')

const categoryCounts = computed(() => {
  const map: Record<string, number> = {}
  for (const c of UX_CATEGORY_META) map[c.id] = 0
  for (const item of props.items) {
    const key = item.category ?? 'equipment'
    map[key] = (map[key] ?? 0) + 1
  }
  return map
})

const filtered = computed(() => {
  let list = props.items
  if (activeCat.value) list = list.filter(a => (a.category ?? 'equipment') === activeCat.value)
  if (query.value.trim()) {
    const q = query.value.toLowerCase()
    list = list.filter(a => a.name.toLowerCase().includes(q))
  }
  return list
})

function thumbColor(item: CatalogItem): string {
  if (item.thumb?.startsWith('#')) return item.thumb
  return '#5a6570'
}

function sizeLabel(item: CatalogItem): string {
  const { width, depth, height } = item.footprint
  const h = height ?? 1
  return `${Math.round(width * 1000)}×${Math.round(depth * 1000)}×${Math.round(h * 1000)}`
}
</script>

<template>
  <aside class="left">
    <div class="panel">
      <div class="tabs">
        <span class="tab on">素材</span>
        <span class="tab">资产库</span>
      </div>
      <div class="search">
        <el-icon><Search /></el-icon>
        <input v-model="query" placeholder="搜索素材…" />
      </div>
      <div class="actions">
        <button type="button" @click="emit('upload')">
          <el-icon><Upload /></el-icon>
          上传
        </button>
        <button type="button" class="ai" @click="emit('ai-image')">
          <el-icon><MagicStick /></el-icon>
          AI 识图
        </button>
      </div>

      <div class="sec-title">分类</div>
      <ul class="cats">
        <li
          v-for="c in UX_CATEGORY_META"
          :key="c.id"
          :class="{ on: activeCat === c.id }"
          @click="activeCat = c.id"
        >
          <span>{{ c.label }}</span>
          <em>{{ categoryCounts[c.id] ?? 0 }}</em>
        </li>
      </ul>

      <div class="sec-title">素材列表</div>
      <div class="asset-grid">
        <div
          v-for="a in filtered"
          :key="a.id + '@' + a.version"
          class="asset"
          draggable="true"
          @dragstart="emit('drag-start', a, $event)"
          @dragend="emit('drag-end')"
        >
          <div class="swatch" :style="{ background: thumbColor(a) }" />
          <div class="meta">
            <strong>{{ a.name }}</strong>
            <small>{{ sizeLabel(a) }}</small>
          </div>
        </div>
        <div v-if="filtered.length === 0" class="empty">该分类暂无素材</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.left {
  display: flex;
  height: 100%;
  border-right: 1px solid #1c2a3d;
  background: #0c1420;
}
.panel {
  width: 268px;
  padding: 12px;
  overflow: auto;
}
.tabs {
  display: flex;
  gap: 14px;
  margin-bottom: 10px;
}
.tab {
  font-size: 12px;
  color: #6d8199;
}
.tab.on {
  color: #e8f4ff;
  border-bottom: 2px solid #1f6fff;
  padding-bottom: 4px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #121c2a;
  border: 1px solid #223247;
  border-radius: 8px;
  padding: 0 10px;
  height: 34px;
  color: #6d8199;
}
.search input {
  flex: 1;
  border: 0;
  background: transparent;
  color: #d7e4f2;
  outline: none;
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 6px;
  margin: 10px 0;
}
.actions button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid #2a3c52;
  background: #152033;
  color: #c5d4e6;
  font-size: 12px;
  cursor: pointer;
}
.actions .ai {
  border-color: #3b5bdb;
  color: #9ec1ff;
}
.sec-title {
  margin: 14px 0 8px;
  font-size: 12px;
  color: #7b90a8;
}
.cats {
  list-style: none;
  margin: 0;
  padding: 0;
}
.cats li {
  display: flex;
  justify-content: space-between;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: #a8bbd0;
  cursor: pointer;
}
.cats li:hover,
.cats li.on {
  background: rgba(31, 111, 255, 0.12);
}
.cats em {
  font-style: normal;
  color: #5d738c;
}
.asset-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.asset {
  display: flex;
  gap: 10px;
  padding: 8px;
  border-radius: 10px;
  background: #121c2a;
  border: 1px solid #1e2e42;
  cursor: grab;
}
.asset:hover {
  border-color: #2f6fed;
}
.swatch {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid #2a3c52;
}
.meta strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
}
.meta small {
  color: #6d8199;
  font-size: 11px;
}
.empty {
  font-size: 12px;
  color: #5d738c;
  padding: 12px 4px;
}
</style>
