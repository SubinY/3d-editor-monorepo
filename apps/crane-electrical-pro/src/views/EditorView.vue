<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { CATALOG_ITEM_MIME, cloneEnvironment } from '@mh/3d-editor'
import type { CatalogItem, EnvironmentJSON, Tool2D, TransformMode } from '@mh/3d-editor'
import { storeToRefs } from 'pinia'
import MainLayout from '@/components/layout/MainLayout.vue'
import ResourcePanel from '@/components/panels/ResourcePanel.vue'
import OutlinePanel from '@/components/panels/OutlinePanel.vue'
import type { OutlineNode } from '@/components/panels/OutlinePanel.vue'
import PropertyPanel from '@/components/panels/PropertyPanel.vue'
import type { SelectedForm } from '@/components/panels/PropertyPanel.vue'
import PanelEditorModal from '@/components/panels/PanelEditorModal.vue'
import ScenePanel from '@/components/panels/ScenePanel.vue'
import DataPanel from '@/components/panels/DataPanel.vue'
import EditorViewport from '@/components/viewport/EditorViewport.vue'
import { useEditorSession } from '@/editor/use-editor-session'
import { useEditorStore } from '@/stores/editor'
import { findCatalogItem } from '@/catalog'
import { panel } from '@mh/3d-editor-assets/common'

const message = useMessage()
const store = useEditorStore()
const { viewMode } = storeToRefs(store)

const viewportRef = ref<InstanceType<typeof EditorViewport>>()
const api = useEditorSession()
const camera3dMode = ref<'orbit' | 'orthographic'>('orbit')
const scaleLabel = ref('1:—')

const outlineNodes = ref<OutlineNode[]>([])
const selectedId = ref('')
const selected = reactive<SelectedForm>({
  id: '',
  name: '',
  typeLabel: '',
  x: 0,
  y: 0,
  z: 0,
  yawDeg: 0,
  width: 0,
  depth: 0,
  height: 0,
  catalog: '',
  ratedVoltage: null,
  ratedCurrent: null,
  status: 'normal'
})
const bounds = reactive({ width: 10, depth: 5, height: 2 })
const environment = ref<EnvironmentJSON | null>(null)
const panelEditorOpen = ref(false)
const panelDraft = ref<panel.PanelContentJSON | null>(null)

const isPanelSelected = computed(() => {
  if (!selected.id || !api.doc.value) return false
  const node = api.doc.value.getNode(selected.id)
  const item = node?.catalogRef ? findCatalogItem(node.catalogRef.id) : undefined
  return item?.kind === 'panel'
})

const propsJson = computed(() => {
  if (!selected.id || !api.doc.value) return '{}'
  const node = api.doc.value.getNode(selected.id)
  return JSON.stringify(node?.props ?? {}, null, 2)
})

const deviceRows = computed(() => {
  const d = api.doc.value
  if (!d) return []
  return d
    .getNodes()
    .filter(n => typeof n.props?.deviceCode === 'string')
    .map(n => ({
      code: String(n.props?.deviceCode),
      name: n.name || '未命名',
      status: typeof n.props?.status === 'string' ? n.props.status : 'normal'
    }))
})

function refreshOutline() {
  const d = api.doc.value
  if (!d) {
    outlineNodes.value = []
    return
  }
  const walls: OutlineNode[] = d.getWalls().map((w, i) => ({
    id: w.id,
    name: `墙体_${i + 1}`,
    visible: true,
    kind: 'wall'
  }))
  const nodes: OutlineNode[] = d.getNodes().map(n => {
    const item = n.catalogRef ? findCatalogItem(n.catalogRef.id) : undefined
    return {
      id: n.id,
      name: n.name || '未命名',
      visible: n.visible !== false,
      kind: item?.kind,
      children: n.children?.map(c => ({
        id: c.id,
        name: c.name || '未命名',
        visible: c.visible !== false
      }))
    }
  })
  outlineNodes.value = [...walls, ...nodes]
  selectedId.value = d.selection.first() ?? ''
}

function refreshSelected() {
  const d = api.doc.value
  const id = d?.selection.first()
  selectedId.value = id ?? ''
  if (!d || !id) {
    selected.id = ''
    return
  }
  const node = d.getNode(id)
  if (!node) {
    selected.id = ''
    return
  }
  const item = node.catalogRef ? findCatalogItem(node.catalogRef.id) : undefined
  selected.id = id
  selected.name = node.name ?? ''
  selected.typeLabel = item?.name || item?.kind || '设备'
  selected.x = Number(node.transform.position[0].toFixed(2))
  selected.y = Number(node.transform.position[1].toFixed(2))
  selected.z = Number(node.transform.position[2].toFixed(2))
  selected.yawDeg = Number(((node.transform.rotation[1] * 180) / Math.PI).toFixed(1))
  selected.width = item?.footprint.width ?? 0
  selected.depth = item?.footprint.depth ?? 0
  selected.height = item?.footprint.height ?? 0
  selected.catalog = node.catalogRef
    ? `${node.catalogRef.id}@${node.catalogRef.version}`
    : '-'
  selected.ratedVoltage =
    typeof node.props?.ratedVoltage === 'number' ? node.props.ratedVoltage : null
  selected.ratedCurrent =
    typeof node.props?.ratedCurrent === 'number' ? node.props.ratedCurrent : null
  selected.status =
    typeof node.props?.status === 'string' ? node.props.status : 'normal'
}

function refreshBounds() {
  const d = api.doc.value
  if (!d) return
  bounds.width = d.bounds.width
  bounds.depth = d.bounds.depth
  bounds.height = d.bounds.height ?? 2
}

function refreshEnvironment() {
  const d = api.doc.value
  environment.value = d ? cloneEnvironment(d.environment) : null
}

function bindDocEvents() {
  const d = api.doc.value
  if (!d) return
  d.on('change', () => {
    refreshOutline()
    refreshSelected()
    refreshBounds()
    refreshEnvironment()
  })
  d.on('selection:changed', () => {
    refreshSelected()
    refreshOutline()
  })
  d.on('environment:updated', () => {
    refreshEnvironment()
  })
}

function waitFrames(n = 2) {
  return new Promise<void>(resolve => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(() => step(left - 1))
    }
    step(n)
  })
}

onMounted(async () => {
  await nextTick()
  await waitFrames(2)
  const el2d = viewportRef.value?.el2d
  const el3d = viewportRef.value?.el3d
  await api.boot({ el2d, el3d })
  bindDocEvents()
  refreshOutline()
  refreshSelected()
  refreshBounds()
  refreshEnvironment()
  await nextTick()
  await waitFrames(1)
  window.dispatchEvent(new Event('resize'))
  api.session.value?.viewport2d?.fitBounds()
  refreshScaleLabel()
  syncCamera3dModeFromEnv()
  store.statusText = '就绪'
  window.addEventListener('keydown', onKeyDown)
})

function refreshScaleLabel() {
  const host = viewportRef.value?.el2d
  const d = api.doc.value
  if (!host || !d) {
    scaleLabel.value = '1:—'
    return
  }
  const w = host.clientWidth || 1
  const span = Math.max(d.bounds.width, d.bounds.depth, 0.1)
  const pxPerMeter = (w - 140) / span
  const ratio = Math.max(1, Math.round(1000 / pxPerMeter))
  scaleLabel.value = `1:${ratio}`
}

function syncCamera3dModeFromEnv() {
  const type = api.doc.value?.environment.defaultView?.type
  camera3dMode.value = type === 'orthographic' ? 'orthographic' : 'orbit'
}

function onZoom2d(direction: 1 | -1) {
  const canvas = viewportRef.value?.el2d?.querySelector('canvas')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  canvas.dispatchEvent(
    new WheelEvent('wheel', {
      deltaY: direction * 100,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
      cancelable: true
    })
  )
  window.setTimeout(refreshScaleLabel, 50)
}

function onFit2d() {
  api.session.value?.viewport2d?.fitBounds()
  refreshScaleLabel()
}

function setCamera3dMode(mode: 'orbit' | 'orthographic') {
  camera3dMode.value = mode
  api.session.value?.viewport3d?.setCameraMode(mode)

  const d = api.doc.value
  if (!d) return
  const env = cloneEnvironment(d.environment)
  if (!env.defaultView) {
    env.defaultView = {
      position: [7.5, 5.5, 8.5],
      target: [0, 0.9, 0],
      fov: 45
    }
  }
  env.defaultView = {
    ...env.defaultView,
    type: mode
  }
  d.commands.setEnvironment(env)
}

function enterIndoorView() {
  api.session.value?.viewport3d?.enterIndoorView({ persist: false })
  camera3dMode.value = api.session.value?.viewport3d?.getCameraMode() ?? 'orbit'
  refreshEnvironment()
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})

watch(viewMode, async () => {
  await nextTick()
  api.session.value?.viewport2d?.resize()
  if (viewMode.value !== '3d') api.session.value?.viewport2d?.fitBounds()
})

function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

  const mod = event.ctrlKey || event.metaKey
  if (mod && (event.key === 'z' || event.key === 'Z')) {
    event.preventDefault()
    if (event.shiftKey) api.redo()
    else api.undo()
    return
  }
  if (mod && (event.key === 'y' || event.key === 'Y')) {
    event.preventDefault()
    api.redo()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    api.removeSelected()
    return
  }
  if (mod) return

  const key = event.key.toLowerCase()
  if (key === 'v') {
    event.preventDefault()
    setTool('select')
  } else if (key === 'w') {
    event.preventDefault()
    setTool('wall')
  } else if (key === 'e') {
    event.preventDefault()
    setTool('select')
    api.setTransformMode('rotate')
  } else if (key === 'r') {
    event.preventDefault()
    setTool('select')
    api.setTransformMode('scale')
  } else if (key === 'f') {
    event.preventDefault()
    api.focusSelection()
  }
}

function setTool(tool: Tool2D) {
  api.setTool(tool)
  if (tool === 'wall' && viewMode.value === '3d') {
    viewMode.value = 'split'
  }
}

function setTransform(mode: TransformMode) {
  setTool('select')
  api.setTransformMode(mode)
}

function onDragStart(event: DragEvent, item: CatalogItem) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(CATALOG_ITEM_MIME, JSON.stringify(item))
  event.dataTransfer.effectAllowed = 'copy'
  api.session.value?.viewport2d?.beginExternalDrag(item)
}

function onDragEnd() {
  api.session.value?.viewport2d?.endExternalDrag()
}

function selectLayer(id: string) {
  api.doc.value?.selection.set(id)
}

function toggleVisible(id: string, visible: boolean) {
  if (!api.doc.value?.getNode(id)) return
  api.doc.value.commands.updateNode(id, { visible })
}

function applyName() {
  if (!selected.id) return
  api.doc.value?.commands.updateNode(selected.id, { name: selected.name })
}

function applyTransform() {
  if (!selected.id) return
  const yaw = (selected.yawDeg * Math.PI) / 180
  api.doc.value?.commands.transformNode(selected.id, {
    position: [selected.x, selected.y, selected.z],
    rotation: [0, yaw, 0]
  })
}

function applyProps() {
  if (!selected.id || !api.doc.value) return
  const node = api.doc.value.getNode(selected.id)
  if (!node) return
  api.doc.value.commands.updateNode(selected.id, {
    props: {
      ...(node.props ?? {}),
      ratedVoltage: selected.ratedVoltage,
      ratedCurrent: selected.ratedCurrent,
      status: selected.status
    }
  })
}

function openPanelEditor() {
  if (!selected.id || !api.doc.value) return
  const node = api.doc.value.getNode(selected.id)
  const raw = node?.props?.panel
  panelDraft.value = panel.isContent(raw) ? raw : panel.createDefaultContent()
  panelEditorOpen.value = true
}

async function confirmPanelEdit(content: panel.PanelContentJSON) {
  if (!selected.id || !api.doc.value) return
  const node = api.doc.value.getNode(selected.id)
  if (!node) return
  api.doc.value.commands.updateNode(selected.id, {
    props: {
      ...(node.props ?? {}),
      panel: content
    }
  })
  message.success('面板已更新')
}

function applyBounds() {
  const d = api.doc.value
  if (!d) return
  d.commands.setBounds({
    width: bounds.width,
    depth: bounds.depth,
    height: bounds.height
  })
}

function applyEnvironment(env: EnvironmentJSON) {
  api.doc.value?.commands.setEnvironment(env)
}

function save() {
  api.persist()
  store.statusText = '已保存到会话'
  message.success('场景已保存（sessionStorage）')
}

function publish() {
  api.persist()
  console.info('[publish]', api.session.value?.toJSON())
  message.info('发布占位：已输出 JSON 到控制台')
}
</script>

<template>
  <MainLayout
    @set-tool="setTool"
    @set-transform="setTransform"
    @undo="api.undo()"
    @redo="api.redo()"
    @save="save"
    @publish="publish"
    @fit="api.fitView()"
  >
    <template #left-resource>
      <ResourcePanel @drag-start="onDragStart" @drag-end="onDragEnd" />
    </template>
    <template #left-outline>
      <OutlinePanel
        :nodes="outlineNodes"
        :selected-id="selectedId"
        @select="selectLayer"
        @toggle-visible="toggleVisible"
      />
    </template>
    <template #viewport>
      <EditorViewport
        ref="viewportRef"
        v-model:view-mode="viewMode"
        :camera3d-mode="camera3dMode"
        :scale-label="scaleLabel"
        @update:camera3d-mode="setCamera3dMode"
        @fit-2d="onFit2d"
        @zoom-2d="onZoom2d"
        @screenshot="message.info('截图占位')"
        @enter-indoor="enterIndoorView"
      />
    </template>
    <template #right-property>
      <PropertyPanel
        :selected="selected"
        :is-panel="isPanelSelected"
        @update:name="applyName"
        @update:transform="applyTransform"
        @update:props="applyProps"
        @edit-panel="openPanelEditor"
        @remove="api.removeSelected()"
      />
    </template>
    <template #right-scene>
      <ScenePanel
        :environment="environment"
        :bounds="bounds"
        @update:environment="applyEnvironment"
        @update:bounds="applyBounds"
      />
    </template>
    <template #right-data>
      <DataPanel :selected-id="selectedId" :props-json="propsJson" :device-rows="deviceRows" />
    </template>
  </MainLayout>
  <PanelEditorModal
    v-model:show="panelEditorOpen"
    :model-value="panelDraft"
    @confirm="confirmPanelEdit"
  />
</template>
