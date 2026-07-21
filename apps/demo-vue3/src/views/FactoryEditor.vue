<template>
  <div class="factory-editor">
    <aside class="toolbar">
      <button
        v-for="btn in toolButtons"
        :key="btn.id"
        class="tool-btn"
        :title="btn.tooltip"
        @click="btn.onClick"
      >
        <Icon :icon="btn.icon" width="20" />
        <span class="sr">{{ btn.label }}</span>
      </button>
    </aside>

    <main class="stage">
      <div class="canvas" ref="canvasRef"></div>
      <div class="drag-preview" v-if="dragPreview.visible" :style="dragPreviewStyle">
        {{ dragPreview.label }}
      </div>
      <div
        v-for="panel in floatingPanels"
        :key="panel.id"
        class="floating"
        :class="{ dragging: panel.dragging }"
        :style="{
          width: panel.size.w + 'px',
          height: panel.size.h + 'px',
          transform: ranslate(px, px),
          zIndex: panel.z
        }"
        @pointerdown.stop="bringToFront(panel)"
      >
        <header class="floating-header" @pointerdown.prevent="startPanelDrag(panel)">
          <span class="handle"></span>
          <span>{{ panel.title }}</span>
          <button class="close" @click.stop="closePanel(panel.id)">×</button>
        </header>
        <section class="floating-body">
          <div class="panel-placeholder">{{ panel.title }} 内容占位</div>
        </section>
      </div>
    </main>

    <div
      class="config-panel"
      :class="{ dragging: config.dragging }"
      :style="{
        width: config.size.w + 'px',
        height: config.size.h + 'px',
        transform: ranslate(px, px),
        zIndex: config.z
      }"
      @pointerdown.stop="bringConfigToFront"
    >
      <header class="config-header" @pointerdown.prevent="startConfigDrag()" @dblclick="dockConfig">
        <span class="handle"></span>
        <span>组态面板</span>
        <button class="close" @click.stop="config.visible = false">×</button>
      </header>
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          :class="['tab', { active: config.activeTab === tab }]"
          @click="config.activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>
      <section class="config-body" v-if="config.visible">
        <div v-if="config.activeTab === '属性'" class="prop-grid">
          <label>
            名称
            <input v-model="selection.name" @input="setProperty('name', selection.name)" />
          </label>
          <div class="triple">
            <label
              >尺寸 X<input
                type="number"
                v-model.number="selection.scale[0]"
                @input="applyTransform"
            /></label>
            <label
              >尺寸 Y<input
                type="number"
                v-model.number="selection.scale[1]"
                @input="applyTransform"
            /></label>
            <label
              >尺寸 Z<input
                type="number"
                v-model.number="selection.scale[2]"
                @input="applyTransform"
            /></label>
          </div>
          <div class="triple">
            <label
              >旋转 X<input
                type="number"
                v-model.number="selection.rotation[0]"
                @input="applyTransform"
            /></label>
            <label
              >旋转 Y<input
                type="number"
                v-model.number="selection.rotation[1]"
                @input="applyTransform"
            /></label>
            <label
              >旋转 Z<input
                type="number"
                v-model.number="selection.rotation[2]"
                @input="applyTransform"
            /></label>
          </div>
          <div class="triple">
            <label
              >位置 X<input
                type="number"
                v-model.number="selection.position[0]"
                @input="applyTransform"
            /></label>
            <label
              >位置 Y<input
                type="number"
                v-model.number="selection.position[1]"
                @input="applyTransform"
            /></label>
            <label
              >位置 Z<input
                type="number"
                v-model.number="selection.position[2]"
                @input="applyTransform"
            /></label>
          </div>
          <label>
            颜色
            <input
              type="color"
              v-model="selection.color"
              @input="setProperty('material.color', selection.color)"
            />
          </label>
          <label>
            透明度
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              v-model.number="selection.opacity"
              @input="setProperty('material.opacity', selection.opacity)"
            />
          </label>
          <div class="toggles">
            <label
              ><input
                type="checkbox"
                v-model="selection.locked"
                @change="setProperty('locked', selection.locked)"
              />
              锁定</label
            >
            <label
              ><input
                type="checkbox"
                v-model="selection.visible"
                @change="setProperty('visible', selection.visible)"
              />
              可见</label
            >
          </div>
        </div>
        <div v-else class="placeholder">待接入</div>
      </section>
    </div>

    <footer class="model-tray">
      <div class="tray-scroll">
        <div
          v-for="item in modelList"
          :key="item.id"
          class="model-card"
          :title="item.label"
          @pointerdown.prevent="beginModelDrag(, item)"
          @touchstart.prevent="beginModelDrag(, item)"
        >
          <div class="model-icon">
            <Icon :icon="item.icon" width="28" />
          </div>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </footer>

    <button class="fab" @click="togglePanelList">
      <Icon icon="heroicons-outline:squares-plus" width="24" />
    </button>
    <div
      v-if="panelList.open"
      class="panel-list"
      :class="{ dragging: panelList.dragging }"
      :style="{ transform: ranslate(px, px) }"
      @pointerdown.stop
    >
      <header class="panel-list-header" @pointerdown.prevent="startPanelListDrag()">
        面板列表
      </header>
      <div class="panel-list-body">
        <div
          v-for="panel in quickPanels"
          :key="panel"
          class="panel-chip"
          @pointerdown.prevent="beginPanelSpawn(, panel)"
        >
          {{ panel }}
        </div>
      </div>
    </div>

    <div class="status-bar">
      <div class="status-left">{{ statusText }}</div>
      <div class="status-right">
        对象 {{ stats.objects }} | Tri {{ stats.triangles }} | FPS {{ stats.fps }} | 坐标
        {{ worldCoord[0].toFixed(1) }}, {{ worldCoord[1].toFixed(1) }},
        {{ worldCoord[2].toFixed(1) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Icon } from '@iconify/vue'
import * as THREE from 'three'
import {
  CoreContext,
  createAmbientLight,
  createBox,
  createDirectionalLight,
  createStandardMaterial,
  EditorEvents
} from '@3d-editor/engine'
import { SnapSystem } from '@3d-editor/extensions'

type ModelType = 'cnc' | 'robot' | 'agv' | 'polish' | 'wash' | 'storage' | 'lamp' | 'fence'

type FloatingPanel = {
  id: string
  title: string
  position: { x: number; y: number }
  size: { w: number; h: number }
  z: number
  dragging: boolean
  dragStart: { x: number; y: number }
  origin: { x: number; y: number }
}

const canvasRef = ref<HTMLElement | null>(null)
const ctx = ref<CoreContext | null>(null)
const snap = new SnapSystem({ gridSize: 1 })
const zCounter = ref(50)

const selection = reactive({
  id: '',
  name: '',
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
  color: '#4da3ff',
  opacity: 1,
  locked: false,
  visible: true
})

const tabs = ['属性', '数据绑定', '动画']
const config = reactive({
  position: { x: window.innerWidth - 340, y: 40 },
  size: { w: 320, h: 420 },
  activeTab: '属性',
  dragging: false,
  dragStart: { x: 0, y: 0 },
  origin: { x: 0, y: 0 },
  z: zCounter.value + 1,
  visible: true
})

const toolButtons = [
  { id: 'new', label: '新建', icon: 'heroicons-outline:document-plus', tooltip: '新建 Ctrl+N', onClick: resetScene },
  { id: 'save', label: '保存', icon: 'heroicons-outline:arrow-down-tray', tooltip: '保存 Ctrl+S', onClick: () => exportScene() },
  { id: 'undo', label: '撤销', icon: 'heroicons-outline:arrow-uturn-left', tooltip: '撤销 Ctrl+Z', onClick: () => ctx.value?.history.undo() },
  { id: 'delete', label: '删除', icon: 'heroicons-outline:trash', tooltip: '删除 Delete', onClick: deleteSelection }
]

const modelList = [
  { id: 'cnc', label: 'CNC', icon: 'heroicons-outline:cube-transparent' },
  { id: 'robot', label: '六轴机器人', icon: 'heroicons-outline:cpu-chip' },
  { id: 'agv', label: 'AGV', icon: 'heroicons-outline:truck' },
  { id: 'polish', label: '抛光机', icon: 'heroicons-outline:sparkles' },
  { id: 'wash', label: '清洗槽', icon: 'heroicons-outline:beaker' },
  { id: 'storage', label: '物料库', icon: 'heroicons-outline:archive-box' },
  { id: 'lamp', label: '工厂灯', icon: 'heroicons-outline:light-bulb' },
  { id: 'fence', label: '护栏', icon: 'heroicons-outline:rectangle-group' }
]

const quickPanels = ['组态面板', '图例面板', '告警面板', '脚本面板']
const floatingPanels = reactive<FloatingPanel[]>([])

const panelList = reactive({
  open: false,
  position: { x: window.innerWidth - 220, y: window.innerHeight - 320 },
  dragging: false,
  start: { x: 0, y: 0 },
  origin: { x: 0, y: 0 }
})

const dragPreview = reactive({ visible: false, x: 0, y: 0, label: '', type: '' as ModelType | '' })
const panelSpawn = reactive({ active: false, x: 0, y: 0, name: '' })

const statusText = ref('就绪')
const stats = reactive({ objects: 0, triangles: 0, fps: 0 })
let fpsLast = performance.now()
let fpsRaf = 0

const worldCoord = computed(() => selection.position)

let transformChangeHandler: (() => void) | null = null
let draggingHandler: ((event: { value: boolean }) => void) | null = null

onMounted(() => {
  if (!canvasRef.value) return
  ctx.value = new CoreContext({ container: canvasRef.value, rendererOptions: { antialias: true, alpha: true } })
  initScene()

  transformChangeHandler = () => syncSelectionFromObject()
  draggingHandler = e => {
    ctx.value?.controls.setEnabled?.(!e.value)
  }
  ctx.value.transform.controls.addEventListener('objectChange', transformChangeHandler)
  ctx.value.transform.controls.addEventListener('dragging-changed', draggingHandler)

  const dom = ctx.value.renderer.domElement
  dom.addEventListener('pointerdown', handleCanvasPick)
  window.addEventListener('pointermove', handlePreviewMove)
  window.addEventListener('pointerup', handlePointerUpGlobal)
  window.addEventListener('keydown', handleShortcuts)

  startStatsLoop()
})

onBeforeUnmount(() => {
  if (ctx.value) {
    ctx.value.renderer.domElement.removeEventListener('pointerdown', handleCanvasPick)
    if (transformChangeHandler) ctx.value.transform.controls.removeEventListener('objectChange', transformChangeHandler)
    if (draggingHandler) ctx.value.transform.controls.removeEventListener('dragging-changed', draggingHandler)
    ctx.value.dispose()
  }
  window.removeEventListener('pointermove', handlePreviewMove)
  window.removeEventListener('pointerup', handlePointerUpGlobal)
  window.removeEventListener('keydown', handleShortcuts)
  cancelAnimationFrame(fpsRaf)
})

function initScene() {
  if (!ctx.value) return
  const scene = ctx.value.scene
  scene.background = new THREE.Color('#131a2c')

  const ambient = createAmbientLight('#8fb5ff', 0.6)
  const dir = createDirectionalLight('#ffffff', 0.9, [60, 120, 60])
  dir.castShadow = true
  ambient.userData.nonSelectable = true
  dir.userData.nonSelectable = true
  ambient.raycast = () => {}
  dir.raycast = () => {}
  scene.add(ambient, dir)

  const grid = new THREE.GridHelper(400, 40, 0x2f3b5a, 0x1b2538)
  grid.userData.nonSelectable = true
  grid.raycast = () => {}
  scene.add(grid)

  ctx.value.scene.add(ctx.value.transform.controls)
  ctx.value.transform.setMode('translate')
  ctx.value.transform.controls.showY = false
  ctx.value.orbit?.controls.target.set(0, 0, 0)
  ctx.value.cameraManager.camera.position.set(90, 70, 120)
  ctx.value.cameraManager.camera.lookAt(0, 0, 0)
}

function beginModelDrag(event: PointerEvent | TouchEvent, item: { id: ModelType; label: string }) {
  dragPreview.visible = true
  dragPreview.label = item.label
  const point = 'touches' in event ? event.touches[0] : event
  dragPreview.x = point.clientX
  dragPreview.y = point.clientY
  dragPreview.type = item.id
}

function handlePreviewMove(event: PointerEvent) {
  if (dragPreview.visible) {
    dragPreview.x = event.clientX
    dragPreview.y = event.clientY
  }
  if (panelSpawn.active) {
    panelSpawn.x = event.clientX
    panelSpawn.y = event.clientY
  }
}

function handlePointerUpGlobal(event: PointerEvent) {
  if (dragPreview.visible) {
    finishModelDrag(event)
  }
  if (panelSpawn.active) {
    finishPanelSpawn(event)
  }
}

function finishModelDrag(event: PointerEvent) {
  if (!ctx.value) {
    dragPreview.visible = false
    return
  }
  const point = projectToFloor(event.clientX, event.clientY)
  if (dragPreview.type) {
    spawnNode(dragPreview.type as ModelType, point ?? new THREE.Vector3())
    statusText.value = '已生成节点'
  }
  dragPreview.visible = false
  dragPreview.type = ''
}

function projectToFloor(clientX: number, clientY: number) {
  if (!ctx.value) return null
  const rect = ctx.value.renderer.domElement.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -((clientY - rect.top) / rect.height) * 2 + 1
  const ray = new THREE.Raycaster()
  ray.setFromCamera(new THREE.Vector2(x, y), ctx.value.cameraManager.camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const target = new THREE.Vector3()
  return ray.ray.intersectPlane(plane, target)
}

function spawnNode(type: ModelType, position: THREE.Vector3) {
  if (!ctx.value) return
  const node = buildNode(type)
  const snapped = snap.snapPosition(position)
  node.position.copy(snapped)
  ctx.value.scene.add(node)
  ctx.value.eventBus.emit(EditorEvents.OBJECT_ADDED, { id: node.uuid })
  selectObject(node)
}

function buildNode(type: ModelType): THREE.Object3D {
  const group = new THREE.Group()
  group.name = modelList.find(m => m.id === type)?.label || type
  group.userData.kind = type

  const colorMap: Record<ModelType, string> = {
    cnc: '#4da3ff',
    robot: '#1abc9c',
    agv: '#f39c12',
    polish: '#e67e22',
    wash: '#16a085',
    storage: '#8e44ad',
    lamp: '#f4e04d',
    fence: '#94a3b8'
  }
  const body = new THREE.Mesh(createBox(4, 3, 4), createStandardMaterial(colorMap[type]))
  body.position.y = 1.5
  body.castShadow = true
  group.add(body)

  if (type === 'lamp') body.scale.set(0.8, 2, 0.8)
  if (type === 'fence') body.scale.set(4, 1, 0.6)
  if (type === 'robot') {
    const head = new THREE.Mesh(createBox(1, 1, 1), createStandardMaterial('#ffe066'))
    head.position.set(0, 3, 0)
    group.add(head)
  }
  return group
}

function handleCanvasPick(event: PointerEvent) {
  if (!ctx.value || ctx.value.transform.controls.dragging) return
  const result = ctx.value.selection.pick(
    event.clientX,
    event.clientY,
    ctx.value.renderer.domElement,
    ctx.value.scene.children
  )
  if (result.object && !result.object.userData?.nonSelectable) {
    const target = findRoot(result.object)
    selectObject(target)
  } else {
    clearSelection()
  }
}

function findRoot(object: THREE.Object3D) {
  let node = object
  while (node.parent && node.parent.type !== 'Scene') node = node.parent
  return node
}

function selectObject(obj: THREE.Object3D | null) {
  if (!ctx.value) return
  if (obj) {
    ctx.value.selection.clear()
    ctx.value.selection.select(obj)
    ctx.value.transform.attach(obj)
    syncSelectionFromObject()
  } else {
    clearSelection()
  }
}

function syncSelectionFromObject() {
  if (!ctx.value) return
  const obj = ctx.value.transform.controls.object as THREE.Object3D | null
  if (!obj) return
  selection.id = obj.uuid
  selection.name = obj.name || obj.userData.kind || obj.type
  selection.position = [obj.position.x, obj.position.y, obj.position.z]
  selection.rotation = [
    THREE.MathUtils.radToDeg(obj.rotation.x),
    THREE.MathUtils.radToDeg(obj.rotation.y),
    THREE.MathUtils.radToDeg(obj.rotation.z)
  ]
  selection.scale = [obj.scale.x, obj.scale.y, obj.scale.z]
  selection.visible = obj.visible
  selection.locked = obj.userData.__locked === true
  const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial
  if (mat && 'opacity' in mat) {
    selection.opacity = mat.opacity ?? 1
    selection.color = '#' + (mat.color?.getHexString?.() || '4da3ff')
  }
}

function applyTransform() {
  if (!ctx.value || !selection.id) return
  const obj = ctx.value.scene.getObjectByProperty('uuid', selection.id)
  if (!obj) return
  obj.position.set(...selection.position)
  obj.rotation.set(
    THREE.MathUtils.degToRad(selection.rotation[0]),
    THREE.MathUtils.degToRad(selection.rotation[1]),
    THREE.MathUtils.degToRad(selection.rotation[2])
  )
  obj.scale.set(...selection.scale)
}

function setProperty(key: string, value: unknown) {
  if (!ctx.value || !selection.id) return
  const obj = ctx.value.scene.getObjectByProperty('uuid', selection.id) as THREE.Mesh
  if (!obj) return
  switch (key) {
    case 'name':
      obj.name = value as string
      break
    case 'material.color':
      if (obj.material && 'color' in obj.material) (obj.material as THREE.MeshStandardMaterial).color.set(value as string)
      break
    case 'material.opacity':
      if (obj.material && 'opacity' in obj.material) {
        const mat = obj.material as THREE.MeshStandardMaterial
        mat.transparent = true
        mat.opacity = value as number
      }
      break
    case 'locked':
      obj.userData.__locked = value === true
      break
    case 'visible':
      obj.visible = value === true
      break
  }
  ctx.value.eventBus.emit(EditorEvents.OBJECT_TRANSFORMED, { id: obj.uuid })
}

function deleteSelection() {
  if (!ctx.value || !selection.id) return
  const obj = ctx.value.scene.getObjectByProperty('uuid', selection.id)
  if (!obj) return
  ctx.value.scene.remove(obj)
  ctx.value.eventBus.emit(EditorEvents.OBJECT_REMOVED, { id: selection.id })
  clearSelection()
}

function clearSelection() {
  if (!ctx.value) return
  ctx.value.selection.clear()
  ctx.value.transform.attach(null)
  selection.id = ''
  selection.name = ''
}

function resetScene() {
  if (!ctx.value) return
  const keep = ctx.value.scene.children.filter(o => o.userData?.nonSelectable)
  ctx.value.scene.clear()
  keep.forEach(o => ctx.value!.scene.add(o))
  ctx.value.scene.add(ctx.value.transform.controls)
  clearSelection()
  statusText.value = '已清空场景'
}

function exportScene() {
  if (!ctx.value) return
  console.log('保存 project.htproj', ctx.value.serializeScene())
  statusText.value = '已保存'
}

function startConfigDrag(event: PointerEvent) {
  config.dragging = true
  config.dragStart = { x: event.clientX, y: event.clientY }
  config.origin = { ...config.position }
  bringConfigToFront()
  window.addEventListener('pointermove', moveConfig)
  window.addEventListener('pointerup', stopConfigDrag)
}

function moveConfig(event: PointerEvent) {
  if (!config.dragging) return
  const dx = event.clientX - config.dragStart.x
  const dy = event.clientY - config.dragStart.y
  config.position.x = clamp(event.clientX - config.dragStart.x + config.origin.x, 0, window.innerWidth - config.size.w)
  config.position.y = clamp(event.clientY - config.dragStart.y + config.origin.y, 0, window.innerHeight - config.size.h)
}

function stopConfigDrag() {
  config.dragging = false
  window.removeEventListener('pointermove', moveConfig)
  window.removeEventListener('pointerup', stopConfigDrag)
}

function dockConfig() {
  config.position.x = window.innerWidth - config.size.w - 24
  config.position.y = 40
}

function bringConfigToFront() {
  config.z = ++zCounter.value
}

function togglePanelList() {
  panelList.open = !panelList.open
}

function startPanelListDrag(event: PointerEvent) {
  panelList.dragging = true
  panelList.start = { x: event.clientX, y: event.clientY }
  panelList.origin = { ...panelList.position }
  window.addEventListener('pointermove', movePanelList)
  window.addEventListener('pointerup', stopPanelListDrag)
}

function movePanelList(event: PointerEvent) {
  if (!panelList.dragging) return
  const dx = event.clientX - panelList.start.x
  const dy = event.clientY - panelList.start.y
  panelList.position.x = clamp(panelList.origin.x + dx, 0, window.innerWidth - 220)
  panelList.position.y = clamp(panelList.origin.y + dy, 0, window.innerHeight - 200)
}

function stopPanelListDrag() {
  panelList.dragging = false
  window.removeEventListener('pointermove', movePanelList)
  window.removeEventListener('pointerup', stopPanelListDrag)
}

function beginPanelSpawn(event: PointerEvent, name: string) {
  panelSpawn.active = true
  panelSpawn.name = name
  panelSpawn.x = event.clientX
  panelSpawn.y = event.clientY
}

function finishPanelSpawn(event: PointerEvent) {
  panelSpawn.active = false
  const newPanel: FloatingPanel = {
    id: ${panelSpawn.name}-,
    title: panelSpawn.name,
    position: {
      x: clamp(event.clientX - 130, 0, window.innerWidth - 260),
      y: clamp(event.clientY - 100, 0, window.innerHeight - 200)
    },
    size: { w: 260, h: 200 },
    z: ++zCounter.value,
    dragging: false,
    dragStart: { x: 0, y: 0 },
    origin: { x: 0, y: 0 }
  }
  floatingPanels.push(newPanel)
}

function startPanelDrag(panel: FloatingPanel, event: PointerEvent) {
  panel.dragging = true
  panel.dragStart = { x: event.clientX, y: event.clientY }
  panel.origin = { ...panel.position }
  bringToFront(panel)
  window.addEventListener('pointermove', moveFloatingDrag)
  window.addEventListener('pointerup', stopFloatingDrag)
}

function moveFloatingDrag(event: PointerEvent) {
  floatingPanels.forEach(panel => {
    if (panel.dragging) {
      const dx = event.clientX - panel.dragStart.x
      const dy = event.clientY - panel.dragStart.y
      panel.position.x = clamp(panel.origin.x + dx, 0, window.innerWidth - panel.size.w)
      panel.position.y = clamp(panel.origin.y + dy, 0, window.innerHeight - panel.size.h)
    }
  })
}

function stopFloatingDrag() {
  floatingPanels.forEach(panel => (panel.dragging = false))
  window.removeEventListener('pointermove', moveFloatingDrag)
  window.removeEventListener('pointerup', stopFloatingDrag)
}

function closePanel(id: string) {
  const idx = floatingPanels.findIndex(p => p.id === id)
  if (idx >= 0) floatingPanels.splice(idx, 1)
}

function bringToFront(panel: FloatingPanel) {
  panel.z = ++zCounter.value
}

function handleShortcuts(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    resetScene()
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    exportScene()
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
    event.preventDefault()
    statusText.value = '打开文件 - 待实现'
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (ctx.value?.history) ctx.value.history.undo()
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    if (ctx.value?.history) ctx.value.history.redo()
  }
  if (event.key === 'Delete') deleteSelection()
}

function startStatsLoop() {
  const loop = (now: number) => {
    if (ctx.value) {
      const delta = now - fpsLast
      fpsLast = now
      stats.fps = Math.round(1000 / Math.max(delta, 1))
      const info = ctx.value.renderer.renderer.info
      stats.objects = ctx.value.scene.children.length
      stats.triangles = info.render?.triangles ?? 0
    }
    fpsRaf = requestAnimationFrame(loop)
  }
  fpsRaf = requestAnimationFrame(loop)
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

const dragPreviewStyle = computed(() => ({
  transform: 	ranslate(px, px),
  opacity: 0.9
}))
</script>

<style scoped>
:global(body) {
  margin: 0;
  overflow: hidden;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.factory-editor {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at 25% 20%, #2f3b5a 0%, #131a2c 50%, #0b1224 100%);
  color: #e8f2ff;
  user-select: none;
}

.stage {
  position: absolute;
  inset: 0;
}

.canvas {
  width: 100%;
  height: 100%;
}

.toolbar {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 56px;
  z-index: 4;
}

.tool-btn {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  border: 1px solid #1f2937;
  background: #1f2937;
  color: #e5e7eb;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: 0.2s;
}

.tool-btn:hover {
  background: #10b981;
  border-color: #10b981;
  color: #0b1224;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  clip: rect(0 0 0 0);
  overflow: hidden;
}

.model-tray {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 24px;
  height: 160px;
  background: linear-gradient(180deg, rgba(15, 19, 32, 0.9), rgba(11, 14, 24, 0.96));
  border-top: 1px solid #1f2937;
  z-index: 3;
  padding: 16px 72px 16px 80px;
}

.tray-scroll {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 120px;
  gap: 12px;
  overflow-x: auto;
  height: 100%;
  align-items: center;
}

.model-card {
  height: 120px;
  width: 120px;
  border-radius: 14px;
  background: #111827;
  border: 1px solid #1f2937;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  color: #e5e7eb;
  cursor: grab;
  transition: 0.2s ease;
}

.model-card:hover {
  background: #0f172a;
  border-color: #10b981;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}

.model-icon {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  background: #1f2937;
  display: grid;
  place-items: center;
}

.drag-preview {
  position: fixed;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: rgba(64, 183, 255, 0.3);
  border: 1px dashed #40b7ff;
  color: #e5e7eb;
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 6;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
}

.config-panel {
  position: absolute;
  right: 24px;
  top: 40px;
  background: rgba(17, 24, 39, 0.95);
  border: 1px solid #1f2937;
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  z-index: 5;
  overflow: hidden;
  backdrop-filter: blur(8px);
}

.config-panel.dragging,
.floating.dragging,
.panel-list.dragging {
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
  opacity: 0.9;
}

.config-header {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background: linear-gradient(90deg, #0f172a, #111827);
  color: #e5e7eb;
  cursor: move;
  border-bottom: 1px solid #1f2937;
}

.handle {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 1px dashed #374151;
  display: inline-block;
}

.close {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
}

.tabs {
  display: flex;
  padding: 6px 8px;
  gap: 6px;
  background: #0b1224;
}

.tab {
  flex: 1;
  border: 1px solid #1f2937;
  border-radius: 8px;
  padding: 6px 0;
  background: #0f172a;
  color: #9ca3af;
  cursor: pointer;
}

.tab.active {
  color: #e5e7eb;
  border-color: #10b981;
  background: #111827;
}

.config-body {
  padding: 12px;
  height: calc(100% - 100px);
  overflow: auto;
  color: #e5e7eb;
}

.prop-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

input,
select,
textarea {
  background: #0f172a;
  border: 1px solid #1f2937;
  color: #e5e7eb;
  border-radius: 8px;
  padding: 6px 8px;
}

input[type='color'] {
  padding: 2px;
  height: 32px;
}

input[type='range'] {
  padding: 0;
}

.triple {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.toggles {
  display: flex;
  gap: 12px;
  align-items: center;
}

.placeholder {
  color: #6b7280;
  text-align: center;
  padding: 20px 0;
}

.fab {
  position: absolute;
  right: 24px;
  bottom: 40px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: #10b981;
  color: #0b1224;
  display: grid;
  place-items: center;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  z-index: 6;
}

.panel-list {
  position: absolute;
  width: 220px;
  background: #0f172a;
  border: 1px solid #1f2937;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  z-index: 7;
}

.panel-list-header {
  padding: 8px 12px;
  border-bottom: 1px solid #1f2937;
  color: #e5e7eb;
  cursor: move;
}

.panel-list-body {
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.panel-chip {
  padding: 6px 10px;
  border-radius: 10px;
  background: #111827;
  border: 1px solid #1f2937;
  color: #e5e7eb;
  font-size: 12px;
  cursor: grab;
}

.floating {
  position: absolute;
  background: rgba(17, 24, 39, 0.95);
  border: 1px solid #1f2937;
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  z-index: 50;
}

.floating-header {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: linear-gradient(90deg, #0f172a, #111827);
  color: #e5e7eb;
  cursor: move;
  border-bottom: 1px solid #1f2937;
}

.floating-body {
  padding: 10px;
  color: #cbd5e1;
}

.panel-placeholder {
  color: #94a3b8;
}

.status-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 24px;
  background: #0b1224;
  border-top: 1px solid #1f2937;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  z-index: 4;
}
</style>
