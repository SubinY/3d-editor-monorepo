<template>
  <div class="editor-layout">
    <!-- 顶部工具栏 -->
    <header class="header">
      <div class="logo">3D Editor</div>
      <div class="toolbar">
        <button @click="handleSave">保存</button>
        <button @click="handleExport">导出 JSON</button>
        <div class="separator"></div>
        <button @click="setTool('translate')" :class="{ active: currentTool === 'translate' }">
          移动
        </button>
        <button @click="setTool('rotate')" :class="{ active: currentTool === 'rotate' }">
          旋转
        </button>
        <button @click="setTool('scale')" :class="{ active: currentTool === 'scale' }">缩放</button>
        <div class="separator"></div>
        <button @click="alignSelection('center')">水平居中</button>
        <button @click="alignSelection('middle')">垂直居中</button>
        <button @click="groupSelection">成组</button>
        <button @click="ungroupSelection">拆分组</button>
      </div>
      <div class="world-info">
        <span>X+ (红) / Y+ (绿) / Z+ (蓝)</span>
        <span v-if="perfStats" class="perf"
          >FPS {{ perfStats.fps }} · Draw {{ perfStats.drawCalls }} · Tri
          {{ perfStats.triangles }}</span
        >
      </div>
    </header>

    <div class="main-content">
      <!-- 左侧面板 -->
      <aside class="left-panel">
        <div class="tabs">
          <div
            v-for="tab in leftTabs"
            :key="tab.id"
            class="tab"
            :class="{ active: activeLeftTab === tab.id }"
            @click="activeLeftTab = tab.id"
          >
            {{ tab.name }}
          </div>
        </div>

        <div class="panel-content">
          <!-- 基础几何体 -->
          <div v-if="activeLeftTab === 'assets'" class="assets-grid">
            <div class="asset-item" @click="addGeometry('box')">
              <div class="icon">📦</div>
              <span>立方体</span>
            </div>
            <div class="asset-item" @click="addGeometry('sphere')">
              <div class="icon">⚪</div>
              <span>球体</span>
            </div>
            <div class="asset-item" @click="addGeometry('plane')">
              <div class="icon">⬜</div>
              <span>平面</span>
            </div>
          </div>

          <!-- 场景树 -->
          <div v-if="activeLeftTab === 'tree'" class="scene-tree">
            <div v-if="selectedObjectIds.length > 0" class="selection-info">
              已选中 {{ selectedObjectIds.length }} 个对象
            </div>
            <TreeNode
              v-for="obj in sceneObjects"
              :key="obj.id"
              :node="obj"
              :selected-ids="selectedObjectIds"
              @node-click="handleTreeNodeClick"
              @toggle-visible="handleToggleVisible"
            />
          </div>
        </div>
      </aside>

      <!-- 中间舞台 -->
      <main class="viewport" ref="viewportRef">
        <!-- 3D Canvas 挂载点 -->
        <!-- 顶部右侧坐标轴辅助（由 HelperController 或 Three.js AxesHelper 提供） -->
      </main>

      <!-- 右侧属性区 -->
      <aside class="right-panel">
        <div v-if="selectedObject" class="properties">
          <h3>属性</h3>

          <div class="prop-group">
            <h4>变换</h4>
            <div class="prop-row">
              <label>位置</label>
              <div class="input-group">
                <input
                  type="number"
                  v-model.number="selectedObject.transform.position[0]"
                  @change="updateTransform"
                  step="0.1"
                />
                <input
                  type="number"
                  v-model.number="selectedObject.transform.position[1]"
                  @change="updateTransform"
                  step="0.1"
                />
                <input
                  type="number"
                  v-model.number="selectedObject.transform.position[2]"
                  @change="updateTransform"
                  step="0.1"
                />
              </div>
            </div>
            <div class="prop-row">
              <label>旋转</label>
              <div class="input-group">
                <input
                  type="number"
                  v-model.number="selectedObject.transform.rotation[0]"
                  @change="updateTransform"
                  step="0.1"
                />
                <input
                  type="number"
                  v-model.number="selectedObject.transform.rotation[1]"
                  @change="updateTransform"
                  step="0.1"
                />
                <input
                  type="number"
                  v-model.number="selectedObject.transform.rotation[2]"
                  @change="updateTransform"
                  step="0.1"
                />
              </div>
            </div>
            <div class="prop-row">
              <label>缩放</label>
              <div class="input-group">
                <input
                  type="number"
                  v-model.number="selectedObject.transform.scale[0]"
                  @change="updateTransform"
                  step="0.1"
                />
                <input
                  type="number"
                  v-model.number="selectedObject.transform.scale[1]"
                  @change="updateTransform"
                  step="0.1"
                />
                <input
                  type="number"
                  v-model.number="selectedObject.transform.scale[2]"
                  @change="updateTransform"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div class="prop-group" v-if="selectedObject.material">
            <h4>材质</h4>
            <div class="prop-row">
              <label>颜色</label>
              <input
                type="color"
                v-model="selectedObject.material.color"
                @change="updateMaterial"
              />
            </div>
          </div>
        </div>
        <div v-else class="empty-state">未选择对象</div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef, computed, defineComponent, h } from 'vue'
import * as THREE from 'three'
import {
  CoreContext,
  createBox,
  createSphere,
  createPlane,
  createStandardMaterial,
  EditorEvents,
  type ControlMode,
  type AlignType
} from '@3d-editor/engine'
import { basicPreset, type BasicPresetState } from '@3d-editor/presets'
import {
  createPerformancePlugin,
  createSnapPlugin,
  type PerformanceStats
} from '@3d-editor/extensions'

// 树节点数据类型
interface TreeNodeData {
  id: string
  name: string
  type: string
  visible: boolean
  isGroup: boolean
  children?: TreeNodeData[]
}

// TreeNode 组件
const TreeNode = defineComponent({
  name: 'TreeNode',
  props: {
    node: { type: Object as () => TreeNodeData, required: true },
    selectedIds: { type: Array as () => string[], required: true },
    level: { type: Number, default: 0 }
  },
  emits: ['node-click', 'toggle-visible'],
  setup(props, { emit }) {
    const isExpanded = ref(true)

    const toggleExpand = (e: MouseEvent) => {
      e.stopPropagation()
      isExpanded.value = !isExpanded.value
    }

    const handleClick = (event: MouseEvent) => {
      emit('node-click', event, props.node.id)
    }

    const toggleVisible = (e: MouseEvent) => {
      e.stopPropagation()
      emit('toggle-visible', props.node.id)
    }

    return () => {
      const hasChildren = props.node.children && props.node.children.length > 0
      const isSelected = props.selectedIds.includes(props.node.id)
      const indent = props.level * 16

      return h('div', { class: 'tree-node-wrapper' }, [
        h(
          'div',
          {
            class: [
              'tree-node',
              {
                selected: isSelected,
                'is-group': props.node.isGroup
              }
            ],
            style: { paddingLeft: `${indent + 8}px` },
            onClick: handleClick
          },
          [
            hasChildren &&
              h(
                'span',
                {
                  class: ['expand-icon', { expanded: isExpanded.value }],
                  onClick: toggleExpand
                },
                isExpanded.value ? '▾' : '▸'
              ),
            h('span', { class: 'node-icon' }, props.node.isGroup ? '📁' : '📄'),
            h('span', { class: 'node-label' }, props.node.name || props.node.type),
            h(
              'span',
              {
                class: ['visibility-icon', { hidden: !props.node.visible }],
                onClick: toggleVisible
              },
              props.node.visible ? '👁' : '🚫'
            )
          ]
        ),
        hasChildren &&
          isExpanded.value &&
          h(
            'div',
            { class: 'tree-children' },
            props.node.children!.map(child =>
              h(TreeNode, {
                key: child.id,
                node: child,
                selectedIds: props.selectedIds,
                level: props.level + 1,
                'onNode-click': (event: MouseEvent, id: string) => emit('node-click', event, id),
                'onToggle-visible': (id: string) => emit('toggle-visible', id)
              })
            )
          )
      ])
    }
  }
})

// 视口引用
const ctx = shallowRef<CoreContext>()
const viewportRef = ref<HTMLElement | null>(null)
const perfStats = ref<PerformanceStats | null>(null)
const currentTool = ref<ControlMode>('translate')
const activeLeftTab = ref('assets')
const selectedObjectId = ref<string | null>(null)
const selectedObjectIds = ref<string[]>([]) // 所有选中对象的 ID 列表
const sceneObjects = ref<TreeNodeData[]>([]) // 场景树数据
// 响应式标记强制刷新视图
const updateTrigger = ref(0)
let transformChangeHandler: (() => void) | null = null
let draggingHandler: ((event: { value: boolean }) => void) | null = null
let justFinishedDragging = false
let presetState: BasicPresetState | null = null

const leftTabs = [
  { id: 'assets', name: '资产' },
  { id: 'tree', name: '场景树' }
]

// 初始化
onMounted(async () => {
  if (!viewportRef.value) return

  // 初始化核心上下文
  ctx.value = new CoreContext({
    container: viewportRef.value,
    rendererOptions: {
      antialias: true,
      logarithmicDepthBuffer: true
    },
    plugins: [
      createSnapPlugin({ gridSize: 1, angleStep: THREE.MathUtils.degToRad(15) }),
      createPerformancePlugin({
        onUpdate: stats => {
          perfStats.value = stats
        }
      })
    ]
  })
  await initScene()
  ;(window as any).testMultiDrag = () => {
    console.log('  - TransformControls.object:', ctx.value?.transform.controls.object?.type)
    console.log('  - attachedObject:', ctx.value?.transform.getAttachedObject()?.type)
  }

  draggingHandler = event => {
    if (ctx.value) {
      ctx.value.controls.setEnabled?.(!event.value)

      if (!event.value) {
        justFinishedDragging = true
        setTimeout(() => {
          justFinishedDragging = false
        }, 100)
      }
    }
  }
  transformChangeHandler = () => {
    const object = ctx.value?.transform.controls.object
    if (!object || !ctx.value) return
    updateTrigger.value++
    ctx.value.eventBus.emit(EditorEvents.OBJECT_TRANSFORMED, { id: object.uuid })
  }
  ctx.value.transform.controls.addEventListener('dragging-changed', draggingHandler)
  ctx.value.transform.controls.addEventListener('objectChange', transformChangeHandler)
  ctx.value.renderer.domElement.addEventListener('pointerdown', handlePointerDown)
  startLoop()
})

onBeforeUnmount(() => {
  if (ctx.value) {
    ctx.value.renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
    if (draggingHandler)
      ctx.value.transform.controls.removeEventListener('dragging-changed', draggingHandler)
    if (transformChangeHandler)
      ctx.value.transform.controls.removeEventListener('objectChange', transformChangeHandler)
    ctx.value.dispose()
  }
})

async function initScene() {
  if (!ctx.value) return

  const applied = await ctx.value.applyPreset(basicPreset, {
    background: '#1e1e1e',
    ambientIntensity: 0.5,
    dirIntensity: 1.2,
    dirPosition: [10, 20, 10],
    grid: { size: 400, divisions: 80, colorCenterLine: 0x2b2b2b, colorGrid: 0x151515 }
  })
  presetState = (applied.state as BasicPresetState) ?? null

  ctx.value.scene.add(ctx.value.transform.controls)

  refreshSceneTree()
}

function startLoop() {
  ctx.value?.eventBus.on(EditorEvents.OBJECT_REMOVED, refreshSceneTree)
  ctx.value?.eventBus.on(EditorEvents.OBJECT_ADDED, refreshSceneTree)
}

const addGeometry = (type: 'box' | 'sphere' | 'plane', position?: [number, number, number]) => {
  if (!ctx.value) return

  let geo: THREE.BufferGeometry
  switch (type) {
    case 'box':
      geo = createBox()
      break
    case 'sphere':
      geo = createSphere()
      break
    case 'plane':
      geo = createPlane()
      break
    default:
      return
  }

  const mat = createStandardMaterial(Math.random() * 0xffffff)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = `${type}_${Date.now().toString().slice(-4)}`

  if (position) {
    mesh.position.set(...position)
  } else {
    mesh.position.set(0, type === 'plane' ? 0 : 0.5, 0)
  }

  if (type === 'plane') {
    mesh.rotation.x = -Math.PI / 2
  }

  ctx.value.actions.addObject(mesh, { select: true })

  return mesh
}

function createRandomObjects() {
  if (!ctx.value) return

  for (let i = 0; i < 10; i++) {
    const types: ('box' | 'sphere')[] = ['box', 'sphere']
    const type = types[Math.floor(Math.random() * types.length)]

    const x = (Math.random() - 0.5) * 20
    const y = Math.random() * 5 + 0.5
    const z = (Math.random() - 0.5) * 20

    addGeometry(type, [x, y, z])
  }

  refreshSceneTree()
}

const testPickingAtDifferentAngles = async () => {
  if (!ctx.value) return

  const testAngles = [
    { pos: [0, 5, 10], name: '正面' },
    { pos: [10, 5, 0], name: '右侧' },
    { pos: [0, 5, -10], name: '背面' },
    { pos: [-10, 5, 0], name: '左侧' },
    { pos: [7, 7, 7], name: '右上前' },
    { pos: [0, 15, 5], name: '俯视' }
  ]

  for (const angle of testAngles) {
    ctx.value.cameraManager.camera.position.set(angle.pos[0], angle.pos[1], angle.pos[2])
    if (ctx.value.orbit) {
      ctx.value.orbit.controls.target.set(0, 0, 0)
      ctx.value.orbit.controls.update()
    } else {
      ctx.value.cameraManager.camera.lookAt(0, 0, 0)
    }

    await new Promise(resolve => setTimeout(resolve, 500))

    const canvas = ctx.value.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const result = ctx.value.selection.pick(centerX, centerY, canvas, ctx.value.scene.children)

    if (result.object) {
    } else {
    }
  }
}

if (typeof window !== 'undefined') {
  ;(window as any).testPicking = {
    createRandom: createRandomObjects,
    testAngles: testPickingAtDifferentAngles
  }
}

const selectObject = (id: string | null) => {
  selectedObjectId.value = id
  if (!ctx.value) return

  if (id) {
    const obj = ctx.value.scene.getObjectByProperty('uuid', id)
    if (obj) {
      updateSelectionHighlight()
      updateTransformControls()

      updateTrigger.value++
      ctx.value.eventBus.emit(EditorEvents.OBJECT_SELECTED, { id })
    }
  } else {
    ctx.value.selection.clear()
    selectedObjectIds.value = []
    ctx.value.highlight.clear()
    ctx.value.transform.attach(null)
    ctx.value.eventBus.emit(EditorEvents.OBJECT_SELECTED, { id: null })
  }
}

const updateSelectionHighlight = () => {
  if (!ctx.value) return
  const selection = ctx.value.selection.getSelection()
  ctx.value.highlight.setHighlightedObjects(selection)
}

const updateTransformControls = () => {
  if (!ctx.value) return
  const selection = ctx.value.selection.getSelection()

  selectedObjectIds.value = ctx.value.selection.getSelectionIds()

  if (selection.length === 0) {
    ctx.value.transform.attach(null)
  } else if (selection.length === 1) {
    ctx.value.transform.attach(selection[0])
  } else {
    ctx.value.transform.attachMultiple(selection)
  }
}

const handleTreeNodeClick = (event: MouseEvent, id: string) => {
  if (!ctx.value) return

  const obj = ctx.value.scene.getObjectByProperty('uuid', id)
  if (!obj) return

  const target = findSelectableRoot(obj)
  if (event.ctrlKey || event.metaKey) {
    ctx.value.selection.toggle(target)
    const selection = ctx.value.selection.getSelection()
    if (selection.length > 0) {
      selectObject(selection[selection.length - 1].uuid)
    } else {
      selectObject(null)
    }
  } else {
    ctx.value.selection.clear()
    ctx.value.selection.select(target)
    selectObject(target.uuid)
  }
}

const handlePointerDown = (event: MouseEvent) => {
  if (!ctx.value) return

  if (ctx.value.transform.controls.dragging) return

  const canvas = ctx.value.renderer.domElement
  const result = ctx.value.selection.pick(event.clientX, event.clientY, canvas, ctx.value.scene.children)
  if (!result.object) {
    if (!event.ctrlKey && !event.metaKey) {
      selectObject(null)
    }
    return
  }

  const target = findSelectableRoot(result.object)
  if (event.ctrlKey || event.metaKey) {
    ctx.value.selection.toggle(target)
    const selection = ctx.value.selection.getSelection()
    if (selection.length > 0) {
      selectObject(selection[selection.length - 1].uuid)
    } else {
      selectObject(null)
    }
  } else {
    ctx.value.selection.clear()
    ctx.value.selection.select(target)
    selectObject(target.uuid)
  }
}

const setTool = (mode: ControlMode) => {
  currentTool.value = mode
  if (!ctx.value) return

  ctx.value.eventBus.emit(EditorEvents.TOOL_CHANGED, { mode })
}

function buildTreeNode(obj: THREE.Object3D): TreeNodeData {
  const isGroup = ctx.value?.sceneGraph.isGroup(obj) || false
  const node: TreeNodeData = {
    id: obj.uuid,
    name: obj.name || obj.type,
    type: obj.type,
    visible: obj.visible,
    isGroup
  }

  node.children = obj.children
    .filter(
      child =>
        child.type === 'Mesh' || (child.type === 'Group' && ctx.value!.sceneGraph.isGroup(child))
    )
    .map(child => buildTreeNode(child))

  return node
}
const refreshSceneTree = () => {
  if (!ctx.value) return
  sceneObjects.value = ctx.value.scene.children
    .filter(o => o.type === 'Mesh' || (o.type === 'Group' && ctx.value!.sceneGraph.isGroup(o)))
    .map(o => buildTreeNode(o))
}

const selectedObject = computed(() => {
  updateTrigger.value

  if (!selectedObjectId.value || !ctx.value) return null
  const obj = ctx.value.scene.getObjectByProperty('uuid', selectedObjectId.value) as THREE.Mesh
  if (!obj) return null

  let materialColor = '#ffffff'
  if (obj.material && 'color' in obj.material) {
    const mat = obj.material as THREE.MeshStandardMaterial
    if (mat.color && typeof mat.color.getHexString === 'function') {
      materialColor = '#' + mat.color.getHexString()
    }
  }

  return {
    transform: {
      position: obj.position.toArray(),
      rotation: obj.rotation.toArray().slice(0, 3),
      scale: obj.scale.toArray()
    },
    material: {
      color: materialColor
    }
  }
})

const updateTransform = () => {
  if (!selectedObjectId.value || !ctx.value || !selectedObject.value) return
  const obj = ctx.value.scene.getObjectByProperty('uuid', selectedObjectId.value)
  if (!obj) return

  const p = selectedObject.value.transform.position
  const r = selectedObject.value.transform.rotation
  const s = selectedObject.value.transform.scale

  obj.position.set(p[0], p[1], p[2])
  obj.rotation.set(r[0], r[1], r[2])
  obj.scale.set(s[0], s[1], s[2])
}

const updateMaterial = () => {
  if (!selectedObjectId.value || !ctx.value || !selectedObject.value) return
  const obj = ctx.value.scene.getObjectByProperty('uuid', selectedObjectId.value) as THREE.Mesh
  if (!obj || !obj.material) return

  if ('color' in obj.material) {
    const mat = obj.material as THREE.MeshStandardMaterial
    if (mat.color && typeof mat.color.set === 'function') {
      mat.color.set(selectedObject.value.material.color)
    }
  }
}

const handleSave = () => {
  if (!ctx.value) return
  const schema = ctx.value.serializeScene()
  console.log('Save scene (DSL)', schema)
}

const handleExport = () => {
  if (!ctx.value) return
  const schema = ctx.value.serializeScene()
  console.log(JSON.stringify(schema, null, 2))
}

function findSelectableRoot(object: THREE.Object3D): THREE.Object3D {
  let current: THREE.Object3D = object
  while (current.parent && current.parent.type !== 'Scene') {
    current = current.parent
  }
  return current
}

const alignSelection = (type: AlignType) => {
  if (!ctx.value) return
  const selection = ctx.value.selection.getSelection()
  if (selection.length < 2) return
  ctx.value.actions.align(selection, type)
  updateTrigger.value++
}

const groupSelection = () => {
  if (!ctx.value) return
  const selection = ctx.value.selection.getSelection()
  if (selection.length < 2) {
    return
  }
  const group = ctx.value.actions.group(selection)
  if (group) {
    refreshSceneTree()
    selectObject(group.uuid)
  }
}

const ungroupSelection = () => {
  if (!ctx.value || !selectedObjectId.value) return
  const obj = ctx.value.scene.getObjectByProperty('uuid', selectedObjectId.value)
  if (!obj) return

  if (!ctx.value.sceneGraph.isGroup(obj) || obj.type !== 'Group') {
    return
  }

  const children = ctx.value.actions.ungroup(obj as THREE.Group)
  refreshSceneTree()
  if (children.length > 0) {
    selectObject(children[0].uuid)
  } else {
    selectObject(null)
  }
}

const handleToggleVisible = (id: string) => {
  if (!ctx.value) return
  const obj = ctx.value.scene.getObjectByProperty('uuid', id)
  if (!obj) return

  ctx.value.sceneGraph.setVisible(obj, !obj.visible)
  refreshSceneTree()
}

const deleteSelection = () => {
  if (!ctx.value || !selectedObjectId.value) return
  const obj = ctx.value.scene.getObjectByProperty('uuid', selectedObjectId.value)
  if (!obj) return

  ctx.value.actions.removeObject(obj)
  selectObject(null)
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    deleteSelection()
  }
}
window.addEventListener('keydown', handleKeyDown)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.editor-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1e1e1e;
  color: #fff;
  font-family: 'Segoe UI', sans-serif;
}

.header {
  height: 48px;
  background: #2d2d2d;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #3d3d3d;
}

.logo {
  font-weight: bold;
  margin-right: 24px;
}

.toolbar {
  display: flex;
  gap: 8px;
  flex: 1;
}

.world-info {
  font-size: 12px;
  color: #888;
  margin-left: 16px;
}
.world-info .perf {
  margin-left: 12px;
  color: #5edcff;
}

.toolbar button {
  background: transparent;
  border: 1px solid transparent;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.toolbar button:hover {
  background: #3d3d3d;
}

.toolbar button.active {
  background: #007acc;
  border-color: #007acc;
}

.separator {
  width: 1px;
  background: #3d3d3d;
  margin: 0 8px;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel,
.right-panel {
  width: 260px;
  background: #252526;
  border-right: 1px solid #3d3d3d;
  display: flex;
  flex-direction: column;
}

.right-panel {
  border-right: none;
  border-left: 1px solid #3d3d3d;
}

.tabs {
  display: flex;
  background: #2d2d2d;
}

.tab {
  flex: 1;
  padding: 8px;
  text-align: center;
  cursor: pointer;
  font-size: 12px;
  color: #999;
}

.tab.active {
  color: #fff;
  background: #252526;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.assets-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.asset-item {
  background: #333;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.asset-item:hover {
  background: #444;
}

.asset-item .icon {
  font-size: 24px;
}

.scene-tree {
  display: flex;
  flex-direction: column;
}

.tree-node-wrapper {
  width: 100%;
}

.tree-node {
  padding: 6px 8px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  width: 100%;
}

.tree-node:hover {
  background: #2a2d2e;
}

.tree-node.selected {
  background: #37373d;
  border-left: 3px solid #1e90ff;
}

.tree-node.is-group {
  font-weight: 500;
  color: #4ec9b0;
}

.expand-icon {
  display: inline-block;
  width: 14px;
  font-size: 10px;
  user-select: none;
  color: #888;
  flex-shrink: 0;
}

.expand-icon:hover {
  color: #fff;
}

.node-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visibility-icon {
  font-size: 14px;
  opacity: 0.6;
  flex-shrink: 0;
  padding: 2px;
  border-radius: 3px;
}

.visibility-icon:hover {
  opacity: 1;
  background: #3d3d3d;
}

.visibility-icon.hidden {
  opacity: 0.3;
}

.tree-children {
  width: 100%;
}

.selection-info {
  padding: 8px;
  background: #2a2d2e;
  color: #00ff00;
  font-size: 12px;
  text-align: center;
  margin-bottom: 8px;
  border-radius: 4px;
}

.viewport {
  flex: 1;
  position: relative;
  background: #1e1e1e;
  overflow: hidden;
}

.properties {
  padding: 16px;
}

.prop-group {
  margin-bottom: 16px;
}

.prop-group h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #999;
}

.prop-row {
  margin-bottom: 8px;
  font-size: 12px;
}

.prop-row label {
  display: block;
  color: #ccc;
  margin-bottom: 4px;
}

.input-group {
  display: flex;
  gap: 4px;
}

.input-group input {
  width: 100%;
}

.prop-row input {
  background: #3c3c3c;
  border: 1px solid #3c3c3c;
  color: #fff;
  padding: 4px;
  border-radius: 2px;
  width: 100%;
  box-sizing: border-box;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #666;
  font-size: 13px;
}
</style>
