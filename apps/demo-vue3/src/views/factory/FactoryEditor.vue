<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { ToolMode } from '@3d-editor/presets'
import EditorCanvas from './components/EditorCanvas.vue'
import LeftToolbar from './components/LeftToolbar.vue'
import BottomComponentBar from './components/BottomComponentBar.vue'
import TransformToolbar from './components/TransformToolbar.vue'
import FloatingPanel from './components/FloatingPanel.vue'
import ProductionPanel from './components/ProductionPanel.vue'
import OperationPanel from './components/OperationPanel.vue'
import EnvironmentPanel from './components/EnvironmentPanel.vue'
import { createEditor } from './composables/useEditor'
import { useFloatingPanels } from './composables/useFloatingPanels'
import { findRoot, projectToFloor } from './composables/useSceneUtils'
import type { ComponentSpec, PanelType } from './types'

const editor = createEditor()
const { panels, togglePanel, bringToFront, setPosition, setSize } = useFloatingPanels()

const selectionCount = ref(0)
const isModelSelected = computed(() => selectionCount.value > 0)

// 监听选中状态
watch(
  () => editor.ctx.value,
  ctx => {
    if (!ctx) return
    // 监听选择改变事件，虽然当前 runtime 没直接暴露事件，但我们可以轮询或者在 select 方法里加逻辑
    // 为了简单且符合现有逻辑，我们在 handlePick 之后更新，或者 watch ctx 的变化
  },
  { immediate: true }
)

// 因为 selection 是 runtime 内部状态，我们包装一下 select 方法来追踪数量
const originalSelect = editor.select
editor.select = (obj: THREE.Object3D | null) => {
  originalSelect(obj)
  selectionCount.value = editor.getSelection().length
}

// 包装 removeSelection 来追踪数量
const originalRemoveSelection = editor.removeSelection
editor.removeSelection = () => {
  originalRemoveSelection()
  selectionCount.value = 0
}

// 包装 reset 来追踪数量
const originalReset = editor.reset
editor.reset = () => {
  originalReset()
  selectionCount.value = 0
}

// 设备组件列表（拖拽/点击创建）
type TransformMode = ToolMode

const componentList: ComponentSpec[] = [
  { id: 'robot', name: '六轴机器人', icon: 'mdi:robot-industrial', color: '#1abc9c' },
  { id: 'engraver', name: '雕刻机', icon: 'mdi:chisel-tip', color: '#3498db' },
  { id: 'cnc', name: 'CNC', icon: 'mdi:engine', color: '#9b59b6' },
  { id: 'agv', name: 'AGV', icon: 'mdi:truck-delivery', color: '#f39c12' },
  { id: 'polish', name: '抛光机', icon: 'mdi:sparkles', color: '#e67e22' },
  { id: 'wash', name: '清洗槽', icon: 'mdi:waves', color: '#16a085' },
  { id: 'line', name: '生产线', icon: 'mdi:ray-start', color: '#2980b9' },
  { id: 'storage', name: '物料库', icon: 'mdi:archive', color: '#8e44ad' }
]
// 创建杠杆占位符（雕刻机）
function createLeverPlaceholder(): THREE.Object3D {
  const group = new THREE.Group()
  group.name = '雕刻机'

  if (leverModelCache) {
    const clone = leverModelCache.clone()
    group.add(clone)
  } else {
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(3, 4, 3),
      new THREE.MeshStandardMaterial({ color: '#3498db' })
    )
    placeholder.position.y = 2
    placeholder.castShadow = true
    placeholder.receiveShadow = true
    group.add(placeholder)

    gltfLoader.load(
      new URL('@/assets/industrial_sci-fi_lever/scene.gltf', import.meta.url).href,
      gltf => {
        group.remove(placeholder)
        const model = gltf.scene
        model.scale.set(3, 3, 3)
        model.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        group.add(model)
        if (!leverModelCache) leverModelCache = gltf.scene.clone()
      },
      undefined,
      err => console.error('加载杠杆模型失败:', err)
    )
  }

  return group
}

// 创建电气箱占位符（CNC）
function createElectricalBoxPlaceholder(): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'CNC'

  if (electricalBoxModelCache) {
    const clone = electricalBoxModelCache.clone()
    group.add(clone)
  } else {
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(4, 5, 3),
      new THREE.MeshStandardMaterial({ color: '#9b59b6' })
    )
    placeholder.position.y = 2.5
    placeholder.castShadow = true
    placeholder.receiveShadow = true
    group.add(placeholder)

    gltfLoader.load(
      new URL('@/assets/industrial_electrical_box-11mb/scene.gltf', import.meta.url).href,
      gltf => {
        group.remove(placeholder)
        const model = gltf.scene
        model.scale.set(1.5, 1.5, 1.5)
        model.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        group.add(model)
        if (!electricalBoxModelCache) electricalBoxModelCache = gltf.scene.clone()
      },
      undefined,
      err => console.error('加载电气箱模型失败:', err)
    )
  }

  return group
}

// 组件工厂映射：仅 3D 模型需要注册，Vue 面板组件无需注册
const componentFactories: Record<string, () => THREE.Object3D> = {
  robot: () => createRobotPlaceholder(),
  engraver: () => createLeverPlaceholder(),
  cnc: () => createElectricalBoxPlaceholder(),
  agv: () => createMesh('#f39c12', 'agv'),
  polish: () => createMesh('#e67e22', 'polish'),
  wash: () => createMesh('#16a085', 'wash'),
  line: () => createMesh('#2980b9', 'line'),
  storage: () => createMesh('#8e44ad', 'storage')
}

// 模型缓存
let robotModelCache: THREE.Object3D | null = null
let leverModelCache: THREE.Object3D | null = null
let electricalBoxModelCache: THREE.Object3D | null = null
const gltfLoader = new GLTFLoader()

// 预加载所有模型
function preloadAllModels() {
  // 预加载机器人模型
  gltfLoader.load(
    new URL('@/assets/industrial_robot/scene.gltf', import.meta.url).href,
    gltf => {
      robotModelCache = gltf.scene
      robotModelCache.scale.set(15, 15, 15)
      robotModelCache.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
    },
    undefined,
    err => console.error('加载机器人模型失败:', err)
  )

  // 预加载杠杆模型（雕刻机）
  gltfLoader.load(
    new URL('@/assets/industrial_sci-fi_lever/scene.gltf', import.meta.url).href,
    gltf => {
      leverModelCache = gltf.scene
      leverModelCache.scale.set(3, 3, 3)
      leverModelCache.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
    },
    undefined,
    err => console.error('加载杠杆模型失败:', err)
  )

  // 预加载电气箱模型（CNC）
  gltfLoader.load(
    new URL('@/assets/industrial_electrical_box-11mb/scene.gltf', import.meta.url).href,
    gltf => {
      electricalBoxModelCache = gltf.scene
      electricalBoxModelCache.scale.set(1.5, 1.5, 1.5)
      electricalBoxModelCache.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
    },
    undefined,
    err => console.error('加载电气箱模型失败:', err)
  )
}

// 创建机器人占位符，异步替换为真实模型
function createRobotPlaceholder(): THREE.Object3D {
  const group = new THREE.Group()
  group.name = '六轴机器人'

  if (robotModelCache) {
    const clone = robotModelCache.clone()
    group.add(clone)
  } else {
    // 占位立方体
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(4, 6, 4),
      new THREE.MeshStandardMaterial({ color: '#1abc9c' })
    )
    placeholder.position.y = 3
    placeholder.castShadow = true
    placeholder.receiveShadow = true
    group.add(placeholder)

    // 异步加载后替换
    gltfLoader.load(new URL('@/assets/industrial_robot/scene.gltf', import.meta.url).href, gltf => {
      group.remove(placeholder)
      const model = gltf.scene
      model.scale.set(15, 15, 15)
      model.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      group.add(model)
      if (!robotModelCache) robotModelCache = gltf.scene.clone()
    })
  }

  return group
}
const registeredIds = new Set<string>()
const activeTool = ref<TransformMode>('translate')

onMounted(() => {
  // 预加载所有模型
  preloadAllModels()
  // 注册所有 3D 组件工厂
  registerAllComponents()

  // 绑定画布拖拽与拾取
  nextTick(() => {
    watch(
      () => editor.ctx.value,
      ctx => {
        if (!ctx) return
        const dom = ctx.renderer.domElement
        dom.addEventListener('dragover', handleDragOver)
        dom.addEventListener('drop', handleDrop)
        dom.addEventListener('pointerdown', handlePick)
        window.addEventListener('keydown', handleKey)
      },
      { immediate: true }
    )
  })
})

// 统一注册所有组件（移除懒注册逻辑）
function registerAllComponents() {
  componentList.forEach(item => {
    if (registeredIds.has(item.id)) return
    const factory = componentFactories[item.id]
    if (!factory) return
    editor.registerComponent(item.id, { createMesh: factory })
    registeredIds.add(item.id)
  })
}

onBeforeUnmount(() => {
  const dom = editor.ctx.value?.renderer.domElement
  if (dom) {
    dom.removeEventListener('dragover', handleDragOver)
    dom.removeEventListener('drop', handleDrop)
    dom.removeEventListener('pointerdown', handlePick)
  }
  window.removeEventListener('keydown', handleKey)
})

// 创建占位几何体（不同颜色/高度区分）
function createMesh(color: string, kind: string) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 4),
    new THREE.MeshStandardMaterial({ color })
  )
  body.position.y = 1.5
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  if (kind === 'line') {
    body.scale.set(2.5, 1, 6)
  }
  if (kind === 'robot') {
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#ffe066' })
    )
    head.position.set(0, 3, 0)
    head.castShadow = true
    head.receiveShadow = true
    group.add(head)
  }
  group.name = componentList.find(c => c.id === kind)?.name || kind
  return group
}

// 拖拽创建
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
function handleDrop(e: DragEvent) {
  e.preventDefault()
  const id = e.dataTransfer?.getData('component-id')
  if (!id) return
  const position = projectToFloorFromEvent(e.clientX, e.clientY)
  spawn(id, position)
}
function onDragStart(e: DragEvent, id: string) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('component-id', id)
  e.dataTransfer.dropEffect = 'copy'
}

// 创建实例并吸附地面
function spawn(id: string, position?: THREE.Vector3 | null) {
  // 组件已在 onMounted 时统一注册，直接使用
  editor.spawn(id, position ?? undefined)
}
function changeTool(mode: TransformMode) {
  activeTool.value = mode
  editor.setTool(mode)
}

function handleResizeFloor(payload: { axis: 'x' | 'z'; delta: number }) {
  if (payload.axis === 'x') {
    editor.resizeFloor(payload.delta, 0)
  } else {
    editor.resizeFloor(0, payload.delta)
  }
}

// 画布拾取选中
function handlePick(event: PointerEvent) {
  if (!editor.ctx.value) return

  // 如果正在拖拽 TransformControls，不处理拾取
  if (editor.ctx.value.transform.controls.dragging) return

  const selectableObjects = editor.ctx.value.scene.children.filter(o => !o.userData?.nonSelectable)
  const result = editor.ctx.value.selection.pick(
    event.clientX,
    event.clientY,
    editor.ctx.value.renderer.domElement,
    selectableObjects
  )
  if (result.object && !result.object.userData?.nonSelectable) {
    const target = findRoot(result.object)
    editor.select(target)
  } else {
    if (!event.ctrlKey && !event.metaKey) {
      editor.select(null)
    }
  }
}

// 屏幕坐标投射到地面
function projectToFloorFromEvent(clientX: number, clientY: number) {
  if (!editor.ctx.value) return null
  return projectToFloor(clientX, clientY, editor.ctx.value)
}

// 左侧工具栏
function handleNew() {
  editor.reset()
}
function handleSave() {
  const data = editor.save()
  console.log('保存场景 JSON', data)
}
function handleUndo() {
  editor.undo()
}
function handleRedo() {
  editor.redo()
}

// 键盘快捷键：Delete/Ctrl+Z/Y/Esc，R/S/G/T 切换工具
function handleKey(e: KeyboardEvent) {
  if (e.key === 'Delete') {
    editor.removeSelection()
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    editor.undo()
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    editor.redo()
  }
  if (e.key.toLowerCase() === 'r') changeTool('rotate')
  if (e.key.toLowerCase() === 's') changeTool('scale')
  if (e.key.toLowerCase() === 'g' || e.key.toLowerCase() === 't') changeTool('translate')
  if (e.key === 'Escape') editor.select(null)
}

// 面板组件映射
function panelComponent(id: PanelType) {
  switch (id) {
    case 'production':
      return ProductionPanel
    case 'operation':
      return OperationPanel
    case 'environment':
      return EnvironmentPanel
    default:
      return ProductionPanel
  }
}
</script>

<template>
  <div class="ht-factory">
    <!-- 左侧操作栏：新建/保存/撤销/重做 -->
    <LeftToolbar
      :on-new="handleNew"
      :on-save="handleSave"
      :on-undo="handleUndo"
      :on-redo="handleRedo"
    />

    <!-- 中心 3D 画布 -->
    <EditorCanvas />

    <!-- 选中模型后的变换工具栏 -->
    <TransformToolbar
      :visible="isModelSelected"
      :active-tool="activeTool"
      @change-tool="changeTool"
    />

    <!-- 可拖拽浮动面板：生产/运行/环保指标 -->
    <FloatingPanel
      v-for="panel in panels"
      :key="panel.id"
      :title="panel.title"
      :icon="panel.icon"
      :visible="panel.visible.value"
      :position="panel.position.value"
      :size="panel.size.value"
      :z-index="panel.zIndex.value"
      @update:visible="panel.visible.value = $event"
      @update:position="pos => setPosition(panel, pos.x, pos.y)"
      @update:size="size => setSize(panel, size.w, size.h)"
      @focus="bringToFront(panel)"
    >
      <component :is="panelComponent(panel.id)" />
    </FloatingPanel>

    <!-- 底部组件栏：8 个可拖拽设备 + 面板开关按钮 -->
    <BottomComponentBar
      :components="componentList"
      @spawn="spawn"
      @dragstart="onDragStart"
      @toggle-panel="togglePanel"
      @resize-floor="handleResizeFloor"
    />
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
  overflow: hidden;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.ht-factory {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at 30% 20%, #1f0a33, #1b214b 45%, #0b0f25);
  color: #e8f2ff;
  user-select: none;
}
</style>
