<template>
  <div class="library-page">
    <header class="library-header">
      <div class="header-left">
        <Icon icon="mdi:cube-scan" class="brand-icon" />
        <h1 class="brand-title">资产管理中心</h1>
      </div>
      <nav class="header-nav">
        <button class="nav-link ghost" :disabled="isImporting" @click="openImportComponent">
          <Icon icon="mdi:file-cube-outline" />
          <span>{{ isImporting ? '导入中...' : '导入组件' }}</span>
        </button>
        <button class="nav-link ghost" :disabled="isImporting" @click="openImportAsset">
          <Icon icon="mdi:file-import-outline" />
          <span>{{ isImporting ? '导入中...' : '导入资产' }}</span>
        </button>
        <button class="nav-link" @click="onCreateNew">
          <Icon icon="mdi:plus-circle-outline" />
          <span>{{ activeTab === 'cabinet' ? '新建资产' : '新建场景' }}</span>
        </button>
      </nav>
    </header>

    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: activeTab === 'cabinet' }" @click="activeTab = 'cabinet'">
        <Icon icon="mdi:archive-outline" />
        <span>资产</span>
        <span class="tab-count">{{ cabinetAssets.length }}</span>
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'scene' }" @click="activeTab = 'scene'">
        <Icon icon="mdi:view-dashboard-outline" />
        <span>场景</span>
        <span class="tab-count">{{ sceneAssets.length }}</span>
      </button>
    </div>

    <div class="library-toolbar">
      <div class="search-box">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          v-model="searchText"
          type="text"
          :placeholder="activeTab === 'cabinet' ? '搜索资产...' : '搜索场景...'"
          class="search-input"
        />
      </div>
      <div class="view-toggle">
        <button class="toggle-btn" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'" title="网格视图">
          <Icon icon="mdi:view-grid-outline" />
        </button>
        <button class="toggle-btn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'" title="列表视图">
          <Icon icon="mdi:view-list-outline" />
        </button>
      </div>
      <span class="asset-count">{{ currentFiltered.length }} 项</span>
    </div>

    <div v-if="currentFiltered.length === 0" class="empty-state">
      <Icon :icon="activeTab === 'cabinet' ? 'mdi:archive-outline' : 'mdi:view-dashboard-outline'" class="empty-icon" />
      <p class="empty-title">{{ searchText ? '未找到匹配项' : (activeTab === 'cabinet' ? '暂无资产' : '暂无场景') }}</p>
      <p class="empty-desc">{{ searchText ? '请尝试其他关键词' : (activeTab === 'cabinet' ? '创建第一个资产' : '创建第一个场景') }}</p>
      <button v-if="!searchText" class="empty-action" @click="onCreateNew">
        <Icon icon="mdi:plus" />
        {{ activeTab === 'cabinet' ? '创建资产' : '创建场景' }}
      </button>
    </div>

    <div v-else-if="viewMode === 'grid'" class="asset-grid">
      <div v-for="item in currentFiltered" :key="item.id" class="asset-card" @click="onClickCard(item)">
        <div class="card-preview" :class="activeTab">
          <template v-if="activeTab === 'cabinet' && assetThumbUrls[item.id]">
            <img class="preview-img" :src="assetThumbUrls[item.id]" alt="thumb" />
          </template>
          <template v-else>
            <Icon :icon="activeTab === 'cabinet' ? 'mdi:archive-outline' : 'mdi:view-dashboard'" class="preview-placeholder" />
          </template>
          <span class="preview-count">
            <template v-if="activeTab === 'cabinet' && (item as AssetRecord).stats">
              {{ (item as AssetRecord).stats?.triangleCount || 0 }} tris · {{ formatSize((item as AssetRecord).stats?.size) }}
            </template>
            <template v-else>
              {{ getObjectCount(item) }} 个对象
            </template>
          </span>
        </div>
        <div class="card-body">
          <div class="card-name">{{ item.name }}</div>
          <div class="card-meta">
            <template v-if="activeTab === 'cabinet' && (item as AssetRecord).stats">
              尺寸：{{ formatSize((item as AssetRecord).stats?.size) }}
            </template>
            <template v-else>
              {{ getObjectCount(item) }} 个对象
            </template>
          </div>
          <div class="card-meta">{{ formatTime(item.updatedAt) }}</div>
        </div>
        <div class="card-actions" @click.stop>
          <button class="action-btn" title="查看" @click="onView(item)">
            <Icon icon="mdi:eye-outline" />
          </button>
          <button class="action-btn" title="编辑" @click="onEdit(item)">
            <Icon icon="mdi:pencil-outline" />
          </button>
          <button class="action-btn danger" title="删除" @click="onDelete(item)">
            <Icon icon="mdi:delete-outline" />
          </button>
        </div>
      </div>
    </div>

    <div v-else class="asset-list">
      <div class="list-header">
        <span class="col-name">名称</span>
        <span class="col-type">类型</span>
        <span class="col-objects">对象数</span>
        <span class="col-time">更新时间</span>
        <span class="col-actions">操作</span>
      </div>
      <div v-for="item in currentFiltered" :key="item.id" class="list-row" @click="onClickCard(item)">
        <span class="col-name">
          <Icon :icon="activeTab === 'cabinet' ? 'mdi:archive-outline' : 'mdi:view-dashboard'" class="row-icon" />
          {{ item.name }}
        </span>
        <span class="col-type">{{ activeTab === 'cabinet' ? '资产' : '场景' }}</span>
        <span class="col-objects">{{ getObjectCount(item) }}</span>
        <span class="col-time">{{ formatTime(item.updatedAt) }}</span>
        <span class="col-actions" @click.stop>
          <button class="action-btn" title="查看" @click="onView(item)">
            <Icon icon="mdi:eye-outline" />
          </button>
          <button class="action-btn" title="编辑" @click="onEdit(item)">
            <Icon icon="mdi:pencil-outline" />
          </button>
          <button class="action-btn danger" title="删除" @click="onDelete(item)">
            <Icon icon="mdi:delete-outline" />
          </button>
        </span>
      </div>
    </div>

    <input
      ref="componentImportRef"
      type="file"
      class="hidden-import-input"
      multiple
      accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp"
      @change="onComponentFilesChange"
    />
    <input
      ref="assetImportRef"
      type="file"
      class="hidden-import-input"
      multiple
      accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp"
      @change="onAssetFilesChange"
    />

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCabinetPicker" class="modal-overlay" @click.self="showCabinetPicker = false">
          <div class="modal-card">
            <div class="modal-header">
              <Icon icon="mdi:archive-cog-outline" class="modal-icon" />
              <span>新建资产：先选择机柜</span>
            </div>
            <div class="modal-body">
              <label class="field-label">机柜组件</label>
              <select v-model="selectedCabinetId" class="field-input">
                <option v-for="cabinet in cabinetCandidates" :key="cabinet.id" :value="cabinet.id">
                  {{ cabinet.name }}
                </option>
              </select>
              <p class="modal-tip">创建资产前必须先选择机柜，用于确定 2D 安装板尺寸。</p>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" @click="showCabinetPicker = false">取消</button>
              <button class="btn-confirm" :disabled="!selectedCabinetId" @click="onConfirmCreateAssetWithCabinet">
                <Icon icon="mdi:check" />
                进入资产编辑
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { assetStore, type AssetRecord } from '@/stores/asset-store'
import { sceneStore, type SceneRecord } from '@/stores/scene-store'
import { componentStore, type ComponentRecord } from '@/stores/component-store'
import { resourceStore } from '@/stores/resource-store'
import { prepareModelFromFiles } from '@/services/model-import-service'
import { loadModelFromResource } from '@/services/model-resource-service'
import { generateThumbnail } from '@/services/thumbnail-service'
import type { SceneSchema } from '@3d-editor/engine'

const route = useRoute()
const router = useRouter()

const activeTab = ref<'cabinet' | 'scene'>('cabinet')
const searchText = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const isImporting = ref(false)
const componentImportRef = ref<HTMLInputElement | null>(null)
const assetImportRef = ref<HTMLInputElement | null>(null)
const showCabinetPicker = ref(false)
const selectedCabinetId = ref('')

const cabinetAssets = ref<AssetRecord[]>([])
const sceneAssets = ref<SceneRecord[]>([])
const assetThumbUrls = ref<Record<string, string>>({})
const thumbUrlDisposers = new Map<string, string>()

const filteredCabinets = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return cabinetAssets.value
  return cabinetAssets.value.filter(a => a.name.toLowerCase().includes(q))
})

const filteredScenes = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return sceneAssets.value
  return sceneAssets.value.filter(s => s.name.toLowerCase().includes(q))
})

const currentFiltered = computed(() =>
  activeTab.value === 'cabinet' ? filteredCabinets.value : filteredScenes.value
)

const cabinetComponents = computed(() =>
  componentStore
    .list()
    .filter(item => item.kind === 'cabinet')
    .sort((a, b) => b.updatedAt - a.updatedAt)
)

const cabinetCandidates = computed(() =>
  cabinetComponents.value
)

onMounted(() => {
  const tab = route.query.tab
  if (tab === 'scene') activeTab.value = 'scene'
  if (tab === 'cabinet') activeTab.value = 'cabinet'
  refreshAll()
  if (route.query.createAsset === '1') {
    setTimeout(() => onCreateNew(), 0)
  }
})

onBeforeUnmount(() => {
  for (const url of thumbUrlDisposers.values()) {
    URL.revokeObjectURL(url)
  }
  thumbUrlDisposers.clear()
})

function refreshAll() {
  cabinetAssets.value = assetStore.list()
  sceneAssets.value = sceneStore.list()
  void refreshThumbs()
}

function getObjectCount(item: AssetRecord | SceneRecord): number {
  if ('stats' in item && item.stats?.meshCount) return item.stats.meshCount
  return item.sceneData?.objects?.length ?? 0
}

function formatSize(size?: [number, number, number]): string {
  if (!size) return '-'
  const [x, y, z] = size
  const f = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '0.00')
  return `${f(x)}×${f(y)}×${f(z)}`
}

async function refreshThumbs() {
  const assets = assetStore.list()
  const next: Record<string, string> = {}

  const alive = new Set<string>()
  for (const a of assets) alive.add(a.id)

  for (const [id, url] of thumbUrlDisposers.entries()) {
    if (!alive.has(id)) {
      URL.revokeObjectURL(url)
      thumbUrlDisposers.delete(id)
    }
  }

  for (const a of assets) {
    if (!a.thumbnailResourceId) continue
    const existing = thumbUrlDisposers.get(a.id)
    if (existing) {
      next[a.id] = existing
      continue
    }
    const blob = await resourceStore.getBlob(a.thumbnailResourceId)
    if (!blob) continue
    const url = URL.createObjectURL(blob)
    thumbUrlDisposers.set(a.id, url)
    next[a.id] = url
  }

  assetThumbUrls.value = next
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onCreateNew() {
  if (activeTab.value === 'cabinet') {
    if (cabinetCandidates.value.length === 0) {
      alert('当前没有可用机柜组件，请先导入机柜组件，或刷新页面等待首启种子资源初始化完成。')
      return
    }
    selectedCabinetId.value = cabinetCandidates.value[0].id
    showCabinetPicker.value = true
  } else {
    router.push('/scene-editor')
  }
}

function onConfirmCreateAssetWithCabinet() {
  if (!selectedCabinetId.value) return
  showCabinetPicker.value = false
  router.push(`/asset-editor?cabinetComponentId=${encodeURIComponent(selectedCabinetId.value)}`)
}

function onClickCard(item: AssetRecord | SceneRecord) {
  onEdit(item)
}

function onView(item: AssetRecord | SceneRecord) {
  if (activeTab.value === 'cabinet') {
    router.push(`/asset-viewer?id=${item.id}`)
  } else {
    router.push(`/scene-viewer?id=${item.id}`)
  }
}

function onEdit(item: AssetRecord | SceneRecord) {
  if (activeTab.value === 'cabinet') {
    router.push(`/asset-editor?id=${item.id}`)
  } else {
    router.push(`/scene-editor?id=${item.id}`)
  }
}

function onDelete(item: AssetRecord | SceneRecord) {
  if (!confirm(`确定删除「${item.name}」？此操作不可撤销。`)) return
  if (activeTab.value === 'cabinet') {
    assetStore.remove(item.id)
  } else {
    sceneStore.remove(item.id)
  }
  refreshAll()
}

function openImportComponent() {
  componentImportRef.value?.click()
}

function openImportAsset() {
  assetImportRef.value?.click()
}

async function onComponentFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  await importAsComponent(files)
  input.value = ''
}

async function onAssetFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  await importAsAsset(files)
  input.value = ''
}

function randomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createImportedAssetScene(name: string, resourceId: string): SceneSchema {
  const objectId = randomId('obj')
  return {
    type: 'scene',
    id: randomId('scene'),
    name,
    version: '1.0.0',
    objects: [
      {
        id: objectId,
        name,
        type: 'group',
        visible: true,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        children: [],
        userData: {
          source: { type: 'gltf', resourceId },
          sourceResourceId: resourceId,
          focusEnabled: false
        }
      }
    ],
    lights: [],
    camera: {
      type: 'perspective',
      fov: 45,
      aspect: 1.777,
      near: 0.1,
      far: 1000,
      position: [8, 10, 12],
      target: [0, 2, 0]
    }
  }
}

async function importAsComponent(files: FileList) {
  try {
    isImporting.value = true
    const prepared = await prepareModelFromFiles(files)
    const resource = await resourceStore.put({
      name: prepared.fileName,
      mime: prepared.blob.type || 'model/gltf-binary',
      blob: prepared.blob
    })

    const now = Date.now()
    const isCabinet = confirm('是否将该组件标记为“机柜组件”？\n选择“确定”后可用于新建资产时的机柜选择。')
    let cabinetMeta: ComponentRecord['cabinetMeta'] | undefined
    if (isCabinet) {
      const widthMm = Number(prompt('请输入机柜安装板宽度（mm）', '800') || '800')
      const heightMm = Number(prompt('请输入机柜安装板高度（mm）', '2200') || '2200')
      cabinetMeta = {
        panel: {
          widthMm: Number.isFinite(widthMm) && widthMm > 0 ? widthMm : 800,
          heightMm: Number.isFinite(heightMm) && heightMm > 0 ? heightMm : 2200,
          origin: 'top-left',
          axis: 'xz'
        }
      }
    }

    const component = {
      id: componentStore.generateId(),
      name: prepared.fileName.replace(/\.glb$/i, ''),
      category: 'imported' as const,
      kind: isCabinet ? 'cabinet' as const : 'part' as const,
      cabinetMeta,
      resourceId: resource.id,
      displayColor: isCabinet ? '#4f7fe1' : '#2de3a2',
      createdAt: now,
      updatedAt: now,
      meshCount: prepared.stats.meshCount,
      nodeCount: prepared.stats.nodeCount,
      triangleCount: prepared.stats.triangleCount,
      size: prepared.stats.size,
      focusEnabled: false,
      importProfile: prepared.profile as Record<string, unknown>
    }
    componentStore.save(component)
    alert(`组件导入成功：${component.name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入失败'
    alert(`组件导入失败：${message}`)
  } finally {
    isImporting.value = false
  }
}

async function importAsAsset(files: FileList) {
  try {
    isImporting.value = true
    const prepared = await prepareModelFromFiles(files)
    const resource = await resourceStore.put({
      name: prepared.fileName,
      mime: prepared.blob.type || 'model/gltf-binary',
      blob: prepared.blob
    })

    const model = await loadModelFromResource(resource.id)
    const thumbBlob = await generateThumbnail(model, { format: 'image/webp' })
    const thumb = await resourceStore.put({
      name: `${prepared.fileName}.thumb.webp`,
      mime: 'image/webp',
      blob: thumbBlob
    })

    const now = Date.now()
    const assetName = prepared.fileName.replace(/\.glb$/i, '')
    const record: AssetRecord = {
      id: assetStore.generateId(),
      name: assetName,
      createdAt: now,
      updatedAt: now,
      storageVersion: 1,
      sourceResourceId: resource.id,
      thumbnailResourceId: thumb.id,
      stats: {
        nodeCount: prepared.stats.nodeCount,
        meshCount: prepared.stats.meshCount,
        triangleCount: prepared.stats.triangleCount,
        size: prepared.stats.size
      },
      importProfile: prepared.profile as Record<string, unknown>,
      sceneData: createImportedAssetScene(assetName, resource.id)
    }
    assetStore.save(record)
    refreshAll()
    activeTab.value = 'cabinet'
    alert(`资产导入成功：${record.name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入失败'
    alert(`资产导入失败：${message}`)
  } finally {
    isImporting.value = false
  }
}
</script>

<style scoped>
.library-page {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: var(--color-bg);
  overflow: hidden;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-icon { font-size: 24px; color: var(--color-primary); }
.brand-title { font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.3px; }

.header-nav { display: flex; gap: 8px; }
.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.nav-link:hover { filter: brightness(1.15); }
.nav-link.ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}
.nav-link.ghost:hover {
  color: var(--color-text);
  border-color: var(--color-border-active);
}
.nav-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hidden-import-input {
  display: none;
}

.tab-bar {
  display: flex;
  gap: 0;
  padding: 0 24px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tab-btn:hover { color: var(--color-text-secondary); }
.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
.tab-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
}
.tab-btn.active .tab-count {
  background: var(--color-primary-dim);
  color: var(--color-primary);
}

.library-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  flex-shrink: 0;
}

.search-box { position: relative; flex: 1; max-width: 360px; }
.search-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  font-size: 16px; color: var(--color-text-muted); pointer-events: none;
}
.search-input {
  width: 100%; padding: 8px 12px 8px 36px;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); color: var(--color-text); font-size: 13px; outline: none;
  transition: border-color var(--transition-fast);
}
.search-input:focus { border-color: var(--color-border-active); }
.search-input::placeholder { color: var(--color-text-muted); }

.view-toggle { display: flex; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; }
.toggle-btn {
  padding: 6px 10px; background: none; border: none;
  color: var(--color-text-muted); font-size: 16px; cursor: pointer;
  transition: all var(--transition-fast);
}
.toggle-btn:hover { color: var(--color-text-secondary); }
.toggle-btn.active { background: var(--color-primary-dim); color: var(--color-primary); }

.asset-count { font-size: 12px; color: var(--color-text-muted); margin-left: auto; }

.empty-state {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
}
.empty-icon { font-size: 56px; color: var(--color-text-muted); opacity: 0.25; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--color-text-secondary); margin: 0; }
.empty-desc { font-size: 13px; color: var(--color-text-muted); margin: 0; }
.empty-action {
  display: flex; align-items: center; gap: 6px; margin-top: 12px;
  padding: 8px 20px; background: var(--color-primary); border: none;
  border-radius: var(--radius-md); color: #fff; font-size: 13px;
  font-weight: 600; cursor: pointer; transition: filter var(--transition-fast);
}
.empty-action:hover { filter: brightness(1.15); }

.asset-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 0 24px 24px;
  overflow-y: auto;
  align-content: start;
}

.asset-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.asset-card:hover {
  border-color: var(--color-border-active);
  box-shadow: 0 4px 20px rgba(77, 163, 255, 0.1);
  transform: translateY(-2px);
}

.card-preview {
  height: 130px;
  background: var(--color-surface-elevated);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.card-preview.scene { background: linear-gradient(135deg, var(--color-surface-elevated), rgba(45, 227, 162, 0.05)); }
.card-preview.cabinet { background: linear-gradient(135deg, var(--color-surface-elevated), rgba(77, 163, 255, 0.05)); }
.preview-placeholder { font-size: 40px; color: var(--color-primary); opacity: 0.3; }
.card-preview.scene .preview-placeholder { color: var(--color-accent); }
.preview-count { font-size: 11px; color: var(--color-text-muted); }
.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 10px;
  opacity: 0.95;
}

.card-body { padding: 12px 14px 8px; }
.card-name {
  font-size: 13px; font-weight: 600; color: var(--color-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card-meta { font-size: 11px; color: var(--color-text-muted); margin-top: 4px; }

.card-actions { display: flex; gap: 4px; padding: 6px 14px 12px; }

.action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; background: none;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  color: var(--color-text-muted); font-size: 15px; cursor: pointer;
  text-decoration: none; transition: all var(--transition-fast);
}
.action-btn:hover {
  color: var(--color-primary); border-color: var(--color-border-active);
  background: var(--color-primary-dim);
}
.action-btn.danger:hover {
  color: var(--color-danger); border-color: rgba(255, 77, 106, 0.4);
  background: rgba(255, 77, 106, 0.1);
}

.asset-list { flex: 1; overflow-y: auto; padding: 0 24px 24px; }
.list-header, .list-row {
  display: grid;
  grid-template-columns: 1fr 60px 80px 160px 100px;
  align-items: center; padding: 10px 14px; gap: 12px;
}
.list-header {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.8px; color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.list-row {
  font-size: 13px; color: var(--color-text-secondary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  cursor: pointer; transition: background var(--transition-fast);
}
.list-row:hover { background: var(--color-primary-dim); }

.row-icon {
  font-size: 16px; color: var(--color-primary); opacity: 0.6;
  margin-right: 8px; vertical-align: middle;
}

.col-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-actions { display: flex; gap: 4px; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  width: 420px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}

.modal-icon {
  font-size: 20px;
  color: var(--color-primary);
}

.modal-body {
  padding: 20px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
}

.field-input:focus {
  border-color: var(--color-border-active);
}

.modal-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
}

.btn-cancel,
.btn-confirm {
  padding: 7px 18px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
}

.btn-cancel {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-cancel:hover {
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.btn-confirm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

.btn-confirm:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card {
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .modal-card {
  transform: scale(0.95) translateY(10px);
}
</style>
