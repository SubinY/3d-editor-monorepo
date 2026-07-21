<template>
  <aside class="asset-sidebar">
    <div class="panel-header">
      <Icon icon="mdi:package-variant-closed" class="header-icon" />
      <span>资产库</span>
    </div>

    <div class="search-box">
      <Icon icon="mdi:magnify" class="search-icon" />
      <input v-model="searchText" type="text" placeholder="搜索资产..." class="search-input" />
    </div>

    <div v-if="filteredAssets.length === 0" class="empty-hint">
      <Icon icon="mdi:package-variant" class="empty-icon" />
      <span>{{ searchText ? '未找到匹配资产' : '暂无资产' }}</span>
      <router-link :to="{ path: '/asset-library', query: { tab: 'cabinet', createAsset: '1' } }" class="create-link">前往创建</router-link>
    </div>

    <div v-else class="asset-list">
      <div
        v-for="asset in filteredAssets"
        :key="asset.id"
        class="asset-item"
        draggable="true"
        @dragstart="onDragStart($event, asset.id)"
        @click="onClickSpawn(asset.id)"
      >
        <div class="item-swatch" />
        <Icon icon="mdi:cube-outline" class="item-icon" />
        <div class="item-info">
          <div class="item-name">{{ asset.name }}</div>
          <div class="item-meta">{{ asset.sceneData.objects.length }} 个对象</div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { assetStore, type AssetRecord } from '@/stores/asset-store'
import { useSceneEditor } from '../composables/useSceneEditor'

const editor = useSceneEditor()
const assets = ref<AssetRecord[]>([])
const searchText = ref('')

const filteredAssets = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return assets.value
  return assets.value.filter(a => a.name.toLowerCase().includes(q))
})

onMounted(() => {
  assets.value = assetStore.list()
})

function onDragStart(e: DragEvent, assetId: string) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('asset-id', assetId)
  e.dataTransfer.dropEffect = 'copy'
}

function onClickSpawn(assetId: string) {
  editor.spawnAsset(assetId)
}
</script>

<style scoped>
.asset-sidebar {
  width: 220px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
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

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 16px;
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
}
.empty-icon {
  font-size: 28px;
  opacity: 0.25;
}
.create-link {
  color: var(--color-primary);
  font-size: 12px;
  text-decoration: none;
}
.create-link:hover {
  text-decoration: underline;
}

.asset-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  position: relative;
  overflow: hidden;
  transition: background var(--transition-fast);
}
.asset-item:hover {
  background: var(--color-primary-dim);
}

.item-swatch {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.asset-item:hover .item-swatch {
  opacity: 1;
}

.item-icon {
  font-size: 20px;
  color: var(--color-primary);
  opacity: 0.5;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}
.item-name {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--transition-fast);
}
.asset-item:hover .item-name {
  color: var(--color-text);
}
.item-meta {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>
