<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import {
  CATALOG_ITEM_MIME,
  createEditor,
  createMemoryCatalog
} from '@mh/3d-editor'
import type {
  CatalogItem,
  CatalogProvider,
  EditorDocument,
  EditorNodeJSON,
  EditorSession,
  TransformMode
} from '@mh/3d-editor'
import { UX_DEMO_CATALOG } from '@/ux-demo/catalog'
import { buildUxDemoSceneJSON } from '@/ux-demo/seed-scene'
import { createUxDemoProceduralResolvers } from '@/ux-demo/models/registry'
import type { EditorTool, RightTab, ViewMode } from '@/ux-demo/mock-data'
import type { MockAsset } from '@/ux-demo/mock-data'
import TopBar from '@/ux-demo/components/TopBar.vue'
import LeftAssets from '@/ux-demo/components/LeftAssets.vue'
import RightInspector from '@/ux-demo/components/RightInspector.vue'
import BottomBar from '@/ux-demo/components/BottomBar.vue'
import ContextToolbar from '@/ux-demo/components/ContextToolbar.vue'
import ViewModeBar from '@/ux-demo/components/ViewModeBar.vue'
import UploadAssetModal from '@/ux-demo/components/overlays/UploadAssetModal.vue'
import AiImageAssetModal from '@/ux-demo/components/overlays/AiImageAssetModal.vue'
import AiLayoutModal from '@/ux-demo/components/overlays/AiLayoutModal.vue'
import PublishPreviewModal from '@/ux-demo/components/overlays/PublishPreviewModal.vue'

const el2d = ref<HTMLElement>()
const el3d = ref<HTMLElement>()
const loading = ref(true)
const toast = ref('')

const catalogItems = ref<CatalogItem[]>([...UX_DEMO_CATALOG])
const catalog: CatalogProvider = createMemoryCatalog(UX_DEMO_CATALOG)

let session: EditorSession | undefined
const doc = shallowRef<EditorDocument>()

const activeTool = ref<EditorTool>('select')
const viewMode = ref<ViewMode>('3d')
const rightTab = ref<RightTab>('properties')
const snapEnabled = ref(true)
const collisionEnabled = ref(true)
const rulersEnabled = ref(true)
const perfVisible = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const selectedId = ref<string | null>(null)
const transformMode = ref<TransformMode>('translate')

const overlays = ref({
  upload: false,
  aiImage: false,
  aiLayout: false,
  publish: false,
  runtimePreview: false
})

const selectedNode = computed<EditorNodeJSON | null>(() => {
  const d = doc.value
  if (!d || !selectedId.value) return null
  return d.getNode(selectedId.value) ?? null
})

const catalogLabel = computed(() => {
  const ref = selectedNode.value?.catalogRef
  if (!ref) return ''
  return catalogItems.value.find(i => i.id === ref.id)?.name ?? ref.id
})

const objectCount = computed(() => doc.value?.getNodes().length ?? 0)

const publishMode = computed(() => (overlays.value.runtimePreview ? 'runtime' : 'publish'))

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = ''
  }, 2200)
}

function refreshHistory() {
  canUndo.value = doc.value?.history.canUndo() ?? false
  canRedo.value = doc.value?.history.canRedo() ?? false
}

function refreshSelection() {
  const ids = doc.value?.selection.get() ?? []
  selectedId.value = ids[0] ?? null
}

function setTool(tool: EditorTool) {
  activeTool.value = tool
  if (tool === 'wall' || tool === 'select') {
    session?.viewport2d?.setTool(tool === 'wall' ? 'wall' : 'select')
  }
  const labels: Partial<Record<EditorTool, string>> = {
    select: '选择',
    wall: '画墙'
  }
  showToast(`当前工具：${labels[tool] ?? tool}`)
}

function setRulersEnabled(v: boolean) {
  rulersEnabled.value = v
  session?.viewport2d?.setRulersVisible(v)
}

function applyViewMode(mode: ViewMode) {
  viewMode.value = mode === 'split' ? '3d' : mode
  void nextTick(() => {
    // 从 display:none / 叠层切换后必须重算 2D 画布尺寸，否则一直是 0×0 空白
    session?.viewport2d?.resize()
    window.dispatchEvent(new Event('resize'))
  })
}

function syncInteraction() {
  session?.setSnapEnabled(snapEnabled.value)
  session?.setCollisionEnabled(collisionEnabled.value)
}

function onDragStart(item: CatalogItem, event: DragEvent) {
  event.dataTransfer?.setData(CATALOG_ITEM_MIME, JSON.stringify(item))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
  session?.viewport2d?.beginExternalDrag(item)
}

function onDragEnd() {
  session?.viewport2d?.endExternalDrag()
}

function undo() {
  doc.value?.history.undo()
  refreshHistory()
}
function redo() {
  doc.value?.history.redo()
  refreshHistory()
}

function removeSelected() {
  const id = selectedId.value
  if (!id || !doc.value) return
  doc.value.commands.removeNode(id)
  showToast('已删除')
}

function duplicateSelected() {
  const node = selectedNode.value
  const d = doc.value
  if (!node || !d) return
  const result = d.commands.duplicateNode(node.id)
  if (result.denied) return
  showToast('已复制')
}

function rotateSelected() {
  const node = selectedNode.value
  const d = doc.value
  if (!node || !d) return
  const r = [...node.transform.rotation] as [number, number, number]
  r[1] += Math.PI / 2
  d.commands.transformNode(node.id, {
    position: [...node.transform.position] as [number, number, number],
    rotation: r,
    scale: [...node.transform.scale] as [number, number, number]
  })
}

function setTransformMode(mode: TransformMode) {
  transformMode.value = mode
  session?.setTransformMode(mode)
  showToast(mode === 'translate' ? '移动模式' : '旋转模式')
}

function updateName(name: string) {
  const id = selectedId.value
  if (!id || !doc.value) return
  doc.value.commands.updateNode(id, { name })
}

function updateTransform(patch: { x?: number; y?: number; z?: number; yawDeg?: number }) {
  const node = selectedNode.value
  const d = doc.value
  if (!node || !d) return
  const position = [...node.transform.position] as [number, number, number]
  const rotation = [...node.transform.rotation] as [number, number, number]
  if (patch.x != null) position[0] = patch.x
  if (patch.y != null) position[1] = patch.y
  if (patch.z != null) position[2] = patch.z
  if (patch.yawDeg != null) rotation[1] = (patch.yawDeg * Math.PI) / 180
  d.commands.transformNode(node.id, {
    position,
    rotation,
    scale: [...node.transform.scale] as [number, number, number]
  })
}

function updateProps(next: Record<string, unknown>) {
  const id = selectedId.value
  if (!id || !doc.value) return
  doc.value.commands.updateNode(id, { props: next })
}

function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  const mod = event.ctrlKey || event.metaKey
  if (mod && (event.key === 'z' || event.key === 'Z')) {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeSelected()
  }
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault()
    session?.viewport3d?.focusSelection()
  }
  if (event.key === 'Escape') {
    doc.value?.selection.clear()
    session?.viewport2d?.endWallChain()
    activeTool.value = 'select'
    session?.viewport2d?.setTool('select')
  }
}

onMounted(async () => {
  try {
    const json = await buildUxDemoSceneJSON()
    await nextTick()
    session = await createEditor({
      catalog,
      document: json,
      mount: {
        canvas2d: el2d.value,
        canvas3d: el3d.value
      },
      viewport3d: {
        hoverOutline: true,
        perfStats: false
      },
      procedural: { resolvers: createUxDemoProceduralResolvers() },
      interaction: {
        snapEnabled: true,
        collisionEnabled: true,
        transformModes: ['translate', 'rotate']
      },
      onDenied: reason => {
        if (reason.startsWith('collision:')) showToast(`碰撞：与「${reason.slice(10)}」重叠`)
        else showToast(`拒绝：${reason}`)
      }
    })
    doc.value = session.document
    const d = session.document
    d.on('change', () => {
      refreshHistory()
      refreshSelection()
    })
    d.on('selection:changed', refreshSelection)
    refreshHistory()
    refreshSelection()
    syncInteraction()
    session.viewport2d?.setRulersVisible(rulersEnabled.value)

    const focusId = (json.metadata as { focusNodeId?: string } | undefined)?.focusNodeId
    if (focusId) {
      d.selection.set(focusId)
      refreshSelection()
    }

    window.addEventListener('keydown', onKeyDown)
  } catch (e) {
    showToast(e instanceof Error ? e.message : '初始化失败')
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  session?.dispose()
  session = undefined
})

function addUploadedAsset(asset: MockAsset) {
  const item: CatalogItem = {
    id: asset.id,
    version: asset.version ?? '1.0.0',
    name: asset.name,
    kind: 'equipment',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width: asset.w, depth: asset.d, height: asset.h },
    thumb: asset.thumb,
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [asset.w, asset.h, asset.d],
      color: asset.thumb
    }
  }
  catalog.add(item)
  catalogItems.value = [item, ...catalogItems.value]
  showToast(`已导入：${asset.name}`)
}

function onViewportDrop(event: DragEvent) {
  event.preventDefault()
  const raw = event.dataTransfer?.getData(CATALOG_ITEM_MIME)
  if (!raw || !doc.value) return
  try {
    const item = JSON.parse(raw) as CatalogItem
    // 三维视口简易落点：场景中心偏前
    doc.value.commands.placeItem(item, {
      position: [0, 0, 1.5],
      name: item.name
    })
    showToast(`已放置 ${item.name}`)
  } catch {
    /* ignore */
  }
  session?.viewport2d?.endExternalDrag()
}

function onPerfVisible(v: boolean) {
  perfVisible.value = v
  session?.viewport3d?.setPerfStatsVisible(v)
}
</script>

<template>
  <div class="ux-demo">
    <TopBar
      :active-tool="activeTool"
      :can-undo="canUndo"
      :can-redo="canRedo"
      @set-tool="setTool"
      @undo="undo"
      @redo="redo"
      @preview="
        overlays.runtimePreview = true;
        overlays.publish = true
      "
      @publish="
        overlays.runtimePreview = false;
        overlays.publish = true
      "
      @ai-layout="overlays.aiLayout = true"
    />

    <div class="main">
      <LeftAssets
        :items="catalogItems"
        @upload="overlays.upload = true"
        @ai-image="overlays.aiImage = true"
        @drag-start="onDragStart"
        @drag-end="onDragEnd"
      />

      <div
        class="center"
        @dragover.prevent
        @drop="onViewportDrop"
      >
        <div v-if="loading" class="loading">正在接入编辑器内核…</div>
        <div class="viewport" :class="viewMode">
          <div
            ref="el2d"
            class="canvas canvas-2d"
            :class="{ active: viewMode === '2d' || viewMode === 'split' }"
          />
          <div
            ref="el3d"
            class="canvas canvas-3d"
            :class="{ active: viewMode === '3d' || viewMode === 'split' }"
          />
        </div>

        <ContextToolbar
          :visible="!!selectedId"
          @move="setTransformMode('translate')"
          @rotate="setTransformMode('rotate')"
          @duplicate="duplicateSelected"
          @delete="removeSelected"
        />
        <ViewModeBar
          :view-mode="viewMode"
          @update:view-mode="applyViewMode"
          @toggle-grid="showToast('网格显示：由环境 helpers 控制')"
          @toggle-snap-guide="snapEnabled = !snapEnabled; syncInteraction()"
        />
      </div>

      <RightInspector
        :node="selectedNode"
        :tab="rightTab"
        :catalog-label="catalogLabel"
        @update:tab="rightTab = $event"
        @update-name="updateName"
        @update-transform="updateTransform"
        @update-props="updateProps"
        @interior="showToast('打开柜内：示意（可后续嵌套 container）')"
      />
    </div>

    <BottomBar
      :snap-enabled="snapEnabled"
      :collision-enabled="collisionEnabled"
      :rulers-enabled="rulersEnabled"
      :show-rulers="viewMode === '2d' || viewMode === 'split'"
      :object-count="objectCount"
      :perf-visible="perfVisible"
      @update:snap-enabled="
        snapEnabled = $event;
        syncInteraction()
      "
      @update:collision-enabled="
        collisionEnabled = $event;
        syncInteraction()
      "
      @update:rulers-enabled="setRulersEnabled"
      @update:perf-visible="onPerfVisible"
    />

    <div v-if="toast" class="toast">{{ toast }}</div>

    <UploadAssetModal
      v-if="overlays.upload"
      @close="overlays.upload = false"
      @submit="
        addUploadedAsset($event);
        overlays.upload = false
      "
    />
    <AiImageAssetModal
      v-if="overlays.aiImage"
      @close="overlays.aiImage = false"
      @submit="
        addUploadedAsset($event);
        overlays.aiImage = false
      "
    />
    <AiLayoutModal
      v-if="overlays.aiLayout"
      @close="overlays.aiLayout = false"
      @apply="
        showToast('已应用布局方案（示意）');
        overlays.aiLayout = false
      "
    />
    <PublishPreviewModal
      v-if="overlays.publish"
      :mode="publishMode"
      @close="overlays.publish = false"
      @published="showToast('发布成功（示意）')"
      @open-runtime="overlays.runtimePreview = true"
    />
  </div>
</template>

<style scoped>
.ux-demo {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #070b12;
  color: #d7e4f2;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}
.main {
  flex: 1;
  min-height: 0;
  display: flex;
}
.center {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: #0a1018;
}
.viewport {
  position: absolute;
  inset: 0;
  display: flex;
}
.viewport.split .canvas {
  position: relative;
  width: 50%;
  height: 100%;
  flex: 1;
  visibility: visible;
  pointer-events: auto;
  z-index: 1;
}
.viewport:not(.split) .canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* 保持尺寸参与布局测量，避免 display:none 导致 2D 画布 0×0 */
  visibility: hidden;
  pointer-events: none;
  z-index: 0;
}
.viewport:not(.split) .canvas.active {
  visibility: visible;
  pointer-events: auto;
  z-index: 1;
}
.canvas {
  min-width: 0;
  min-height: 0;
}
.canvas-2d {
  background: #0d1520;
}
.canvas-3d {
  background: #0a1018;
}
.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 20;
  background: #070b12;
  color: #8ea4bd;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 64px;
  transform: translateX(-50%);
  background: rgba(15, 24, 38, 0.95);
  border: 1px solid #2a3c52;
  color: #e8f4ff;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  z-index: 60;
}
</style>
