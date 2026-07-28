<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { CATALOG_ITEM_MIME, cloneEnvironment, createEditor } from '@3d-editor/editor'
import type {
  CatalogItem,
  DocumentKind,
  EditorDocument,
  EditorDocumentJSON,
  EditorNodeJSON,
  EditorSession,
  EnvironmentJSON,
  MemoryCatalog,
  TransformMode,
  WallJSON
} from '@3d-editor/editor'
import WorkbenchToolbar from './workbench/WorkbenchToolbar.vue'
import LeftPanel from './workbench/LeftPanel.vue'
import ViewportArea from './workbench/ViewportArea.vue'
import RightPanel from './workbench/RightPanel.vue'
import type { LiveCameraPose } from './workbench/environment-panel/types'
import type { AssetGroup, EditorTool, LayerTreeItem, ViewMode } from './workbench/types'
import {
  emptyNodeBindings,
  readNodeBindings,
  writeNodeBindings,
  type NodeBindingsProps
} from '@/business/node-bindings'

const props = defineProps<{
  kind: DocumentKind
  catalog: MemoryCatalog
  initial: EditorDocumentJSON
}>()

const emit = defineEmits<{
  save: [json: EditorDocumentJSON]
  back: []
}>()

const el2d = ref<HTMLElement>()
const el3d = ref<HTMLElement>()
const doc = shallowRef<EditorDocument>()
let session: EditorSession | undefined

const docName = ref('')
const tool = ref<EditorTool>('select')
const viewMode = ref<ViewMode>('split')
const snapEnabled = ref(true)
const collisionEnabled = ref(true)
const rulersEnabled = ref(true)
const transformMode = ref<TransformMode>('translate')
const canUndo = ref(false)
const canRedo = ref(false)

const groups = ref<AssetGroup[]>([])
const layerNodes = ref<LayerTreeItem[]>([])
const selectedId = ref('')

const selectedNode = reactive({
  id: '',
  name: '',
  x: 0,
  y: 0,
  z: 0,
  yawDeg: 0,
  catalog: ''
})
const nodeBindings = reactive<NodeBindingsProps>(emptyNodeBindings())
const selectedWall = shallowRef<WallJSON | null>(null)
const boundsForm = reactive({ width: 0, depth: 0, height: 0 })
const environment = shallowRef<EnvironmentJSON | null>(null)
const liveCameraPose = shallowRef<LiveCameraPose | null>(null)
let unsubCameraPose: (() => void) | undefined
let cameraPosePersistTimer: number | undefined

const isScene = computed(() => props.kind === 'scene')

function deniedMessage(reason: string): string {
  if (reason.startsWith('collision:')) {
    return `与「${reason.slice('collision:'.length)}」位置冲突，已拒绝`
  }
  return `操作被拒绝：${reason}`
}

function showToast(message: string, kind: 'info' | 'error' = 'info') {
  if (kind === 'error') ElMessage.error(message)
  else ElMessage.success(message)
}

function refreshHistoryState() {
  canUndo.value = doc.value?.history.canUndo() ?? false
  canRedo.value = doc.value?.history.canRedo() ?? false
}

function refreshBoundsForm() {
  const d = doc.value
  if (!d) return
  boundsForm.width = d.bounds.width
  boundsForm.depth = d.bounds.depth
  boundsForm.height = d.bounds.height ?? 0
}

function refreshEnvironment() {
  const d = doc.value
  if (!d) {
    environment.value = null
    return
  }
  environment.value = cloneEnvironment(d.environment)
}

async function mapLayerItem(node: EditorNodeJSON, d: EditorDocument): Promise<LayerTreeItem> {
  const item: LayerTreeItem = {
    id: node.id,
    selectId: node.id,
    name: node.name || '未命名',
    displayId: node.id,
    visible: node.visible !== false,
    editable: true
  }

  // 文档内真子节点：可编辑层级
  if (node.children?.length) {
    item.children = await Promise.all(node.children.map(child => mapLayerItem(child, d)))
    return item
  }

  // catalog document 型：只读投影内部 nodes（非场景 document 成员）
  if (node.catalogRef) {
    const catalogItem =
      d.getCachedItem(node) ??
      (await props.catalog.get(node.catalogRef.id, node.catalogRef.version))
    const nested = catalogItem?.document?.nodes
    if (nested?.length) {
      item.children = nested.map(child => ({
        id: `${node.id}/${child.id}`,
        selectId: node.id,
        name: child.name || '未命名',
        displayId: child.id,
        visible: child.visible !== false,
        editable: false
      }))
    }
  }

  return item
}

async function refreshLayers() {
  const d = doc.value
  if (!d) {
    layerNodes.value = []
    selectedId.value = ''
    return
  }
  layerNodes.value = await Promise.all(d.getNodes().map(node => mapLayerItem(node, d)))
  selectedId.value = d.selection.first() ?? ''
}

function syncBindingsFrom(next: NodeBindingsProps) {
  nodeBindings.bindings = next.bindings.map(b => ({ ...b }))
  nodeBindings.events = next.events.map(e => ({
    ...e,
    when: { ...e.when },
    then: { ...e.then }
  }))
}

function refreshSelected() {
  const d = doc.value
  const id = d?.selection.first()
  selectedWall.value = null
  selectedId.value = id ?? ''
  if (!d || !id) {
    selectedNode.id = ''
    syncBindingsFrom(emptyNodeBindings())
    return
  }
  const node = d.getNode(id)
  if (node) {
    selectedNode.id = id
    selectedNode.name = node.name ?? ''
    selectedNode.x = Number(node.transform.position[0].toFixed(2))
    selectedNode.y = Number(node.transform.position[1].toFixed(2))
    selectedNode.z = Number(node.transform.position[2].toFixed(2))
    selectedNode.yawDeg = Number(
      (
        ((isScene.value ? node.transform.rotation[1] : node.transform.rotation[2]) * 180) /
        Math.PI
      ).toFixed(1)
    )
    selectedNode.catalog = node.catalogRef
      ? `${node.catalogRef.id}@${node.catalogRef.version}`
      : '-'
    syncBindingsFrom(readNodeBindings(node))
    return
  }
  selectedNode.id = ''
  syncBindingsFrom(emptyNodeBindings())
  const wall = d.getWall(id)
  if (wall) selectedWall.value = { ...wall }
}

onMounted(async () => {
  session = await createEditor({
    catalog: props.catalog,
    document: props.initial,
    mount: {
      canvas2d: el2d.value,
      canvas3d: el3d.value
    },
    interaction: {
      transformModes: ['translate', 'rotate']
    },
    onDenied: reason => showToast(deniedMessage(reason), 'error')
  })

  const d = session.document
  doc.value = d
  docName.value = d.name
  const interaction = session.getInteraction()
  snapEnabled.value = interaction.snapEnabled
  collisionEnabled.value = interaction.collisionEnabled
  transformMode.value = interaction.transformMode
  session.viewport2d?.setRulersVisible(rulersEnabled.value)
  refreshBoundsForm()
  refreshEnvironment()
  await refreshLayers()
  refreshHistoryState()

  d.on('change', () => {
    refreshHistoryState()
    refreshSelected()
    refreshBoundsForm()
    refreshEnvironment()
    void refreshLayers()
  })
  d.on('selection:changed', () => {
    refreshSelected()
    void refreshLayers()
  })
  d.on('environment:updated', () => {
    refreshEnvironment()
  })

  unsubCameraPose = session.viewport3d?.onCameraPoseChange(pose => {
    const rounded: LiveCameraPose = {
      position: [
        Math.round(pose.position[0] * 1000) / 1000,
        Math.round(pose.position[1] * 1000) / 1000,
        Math.round(pose.position[2] * 1000) / 1000
      ],
      target: [
        Math.round(pose.target[0] * 1000) / 1000,
        Math.round(pose.target[1] * 1000) / 1000,
        Math.round(pose.target[2] * 1000) / 1000
      ],
      radius: Math.round(pose.radius * 1000) / 1000
    }
    liveCameraPose.value = rounded
    window.clearTimeout(cameraPosePersistTimer)
    cameraPosePersistTimer = window.setTimeout(() => {
      persistLiveCameraPose(rounded)
    }, 160)
  })

  const items = await props.catalog.list({ placeableIn: props.kind })
  if (isScene.value) {
    groups.value = [
      {
        key: 'fixture',
        label: '墙体构件',
        items: items.filter(item => item.category === 'fixture')
      },
      {
        key: 'equipment',
        label: '电柜',
        items: items.filter(item => item.category === 'equipment')
      }
    ]
  } else {
    groups.value = [
      {
        key: 'component',
        label: '元器件',
        items: items.filter(item => item.category === 'component')
      }
    ]
  }

  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.clearTimeout(cameraPosePersistTimer)
  unsubCameraPose?.()
  unsubCameraPose = undefined
  session?.dispose()
  session = undefined
})

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
  if (mod && (event.key === 'y' || event.key === 'Y')) {
    event.preventDefault()
    redo()
    return
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeSelected()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    session?.viewport2d?.endWallChain()
    if (tool.value === 'wall') setTool('select')
    else doc.value?.selection.clear()
    return
  }

  if (isScene.value && (event.key === 'w' || event.key === 'W') && !mod) {
    event.preventDefault()
    setTool(tool.value === 'wall' ? 'select' : 'wall')
  }
}

function setTool(next: EditorTool) {
  tool.value = next
  session?.viewport2d?.setTool(next)
  if (next === 'wall' && viewMode.value === '3d') {
    setViewMode('split')
  }
}

async function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  await nextTick()
  session?.viewport2d?.resize()
  window.dispatchEvent(new Event('resize'))
  if (mode !== '3d') session?.viewport2d?.fitBounds()
}

function undo() {
  doc.value?.history.undo()
}

function redo() {
  doc.value?.history.redo()
}

function fitView() {
  session?.viewport2d?.fitBounds()
}

function toggleSnap() {
  const next = !snapEnabled.value
  session?.setSnapEnabled(next)
  snapEnabled.value = session?.getInteraction().snapEnabled ?? next
}

function toggleRulers() {
  const next = !rulersEnabled.value
  rulersEnabled.value = next
  session?.viewport2d?.setRulersVisible(next)
}

function toggleCollision() {
  const next = !collisionEnabled.value
  session?.setCollisionEnabled(next)
  collisionEnabled.value = session?.getInteraction().collisionEnabled ?? next
}

function setTransformMode(mode: TransformMode) {
  session?.setTransformMode(mode)
  transformMode.value = session?.getInteraction().transformMode ?? mode
}

function save() {
  const d = doc.value
  if (!d) return
  d.name = docName.value || d.name
  emit('save', d.toJSON())
  showToast(isScene.value ? '已保存电柜室' : '已保存电柜（同时发布为柜资产）')
}

function onAssetDragStart(event: DragEvent, item: CatalogItem) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(CATALOG_ITEM_MIME, JSON.stringify(item))
  event.dataTransfer.effectAllowed = 'copy'
  session?.viewport2d?.beginExternalDrag(item)
}

function onAssetDragEnd() {
  session?.viewport2d?.endExternalDrag()
}

function selectLayer(id: string) {
  doc.value?.selection.set(id)
}

function toggleNodeVisible(id: string, visible: boolean) {
  doc.value?.commands.updateNode(id, { visible })
}

function applyNodeTransform() {
  if (!selectedNode.id) return
  const yaw = (selectedNode.yawDeg * Math.PI) / 180
  const result = doc.value?.commands.transformNode(selectedNode.id, {
    position: [selectedNode.x, selectedNode.y, selectedNode.z],
    rotation: isScene.value ? [0, yaw, 0] : [0, 0, yaw]
  })
  if (result && !result.ok && result.denied) {
    showToast(deniedMessage(result.denied), 'error')
    refreshSelected()
  }
}

function applyNodeName() {
  if (!selectedNode.id) return
  doc.value?.commands.updateNode(selectedNode.id, { name: selectedNode.name })
}

function applyNodeBindings(next: NodeBindingsProps) {
  if (!selectedNode.id || !doc.value) return
  writeNodeBindings(doc.value, selectedNode.id, next)
  syncBindingsFrom(next)
}

function removeSelected() {
  const d = doc.value
  if (!d) return
  if (selectedNode.id) {
    d.commands.removeNode(selectedNode.id)
    return
  }
  if (selectedWall.value) {
    d.commands.removeWall(selectedWall.value.id)
    d.selection.clear()
  }
}

function applyBounds() {
  doc.value?.commands.setBounds({
    width: boundsForm.width || undefined,
    depth: boundsForm.depth || undefined,
    height: boundsForm.height || undefined
  })
  session?.viewport2d?.fitBounds()
}

function persistLiveCameraPose(pose: LiveCameraPose) {
  const d = doc.value
  if (!d) return
  const cur = d.environment.defaultView
  if (
    cur &&
    Math.abs(cur.position[0] - pose.position[0]) < 1e-3 &&
    Math.abs(cur.position[1] - pose.position[1]) < 1e-3 &&
    Math.abs(cur.position[2] - pose.position[2]) < 1e-3 &&
    Math.abs(cur.target[0] - pose.target[0]) < 1e-3 &&
    Math.abs(cur.target[1] - pose.target[1]) < 1e-3 &&
    Math.abs(cur.target[2] - pose.target[2]) < 1e-3
  ) {
    return
  }
  const env = cloneEnvironment(d.environment)
  const view = env.defaultView ?? {
    type: 'orbit' as const,
    position: pose.position,
    target: pose.target,
    fov: 50
  }
  view.position = [
    Math.round(pose.position[0] * 1000) / 1000,
    Math.round(pose.position[1] * 1000) / 1000,
    Math.round(pose.position[2] * 1000) / 1000
  ]
  view.target = [
    Math.round(pose.target[0] * 1000) / 1000,
    Math.round(pose.target[1] * 1000) / 1000,
    Math.round(pose.target[2] * 1000) / 1000
  ]
  env.defaultView = view
  d.commands.setEnvironment(env, { history: false })
}

function applyEnvironment(env: EnvironmentJSON) {
  liveCameraPose.value = null
  doc.value?.commands.setEnvironment(env)
}
</script>

<template>
  <div class="workbench">
    <WorkbenchToolbar
      v-model:doc-name="docName"
      :is-scene="isScene"
      :tool="tool"
      :view-mode="viewMode"
      :snap-enabled="snapEnabled"
      :collision-enabled="collisionEnabled"
      :rulers-enabled="rulersEnabled"
      :transform-mode="transformMode"
      :can-undo="canUndo"
      :can-redo="canRedo"
      @back="emit('back')"
      @set-tool="setTool"
      @undo="undo"
      @redo="redo"
      @remove="removeSelected"
      @fit-view="fitView"
      @toggle-snap="toggleSnap"
      @toggle-collision="toggleCollision"
      @toggle-rulers="toggleRulers"
      @set-transform-mode="setTransformMode"
      @set-view-mode="setViewMode"
      @save="save"
    />

    <div class="body">
      <LeftPanel
        :groups="groups"
        :is-scene="isScene"
        :tool="tool"
        :nodes="layerNodes"
        :selected-id="selectedId"
        @set-tool="setTool"
        @drag-start="onAssetDragStart"
        @drag-end="onAssetDragEnd"
        @select-layer="selectLayer"
        @toggle-visible="toggleNodeVisible"
      />

      <ViewportArea :view-mode="viewMode">
        <template #canvas2d>
          <div ref="el2d" class="viewport-host" />
        </template>
        <template #canvas3d>
          <div ref="el3d" class="viewport-host" />
        </template>
      </ViewportArea>

      <RightPanel
        :is-scene="isScene"
        :bounds-form="boundsForm"
        :selected-node="selectedNode"
        :selected-wall="selectedWall"
        :node-bindings="nodeBindings"
        :environment="environment"
        :view-mode="viewMode"
        :live-camera-pose="liveCameraPose"
        @update:bounds="applyBounds"
        @update:name="applyNodeName"
        @update:transform="applyNodeTransform"
        @update:bindings="applyNodeBindings"
        @remove="removeSelected"
        @apply-environment="applyEnvironment"
      />
    </div>
  </div>
</template>

<style scoped>
.workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #d5e0ec;
  background: #0b111b;
  position: relative;
}

.body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.viewport-host {
  width: 100%;
  height: 100%;
}
</style>
