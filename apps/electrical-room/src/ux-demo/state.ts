import { computed, reactive, ref } from 'vue'
import {
  AI_LAYOUT_PLANS,
  INITIAL_ASSETS,
  INITIAL_NODES,
  ROOM,
  TOOLS,
  createDefaultBindings,
  type EditorTool,
  type MockAsset,
  type MockEventRule,
  type MockNode,
  type RightTab,
  type ViewMode,
  type ViewportBackend
} from './mock-data'

let nodeSeq = 100

export function createUxDemoState() {
  const assets = ref<MockAsset[]>([...INITIAL_ASSETS])
  const nodes = ref<MockNode[]>(INITIAL_NODES.map(n => ({ ...n, bindings: [...n.bindings], events: [...n.events] })))
  const selectedId = ref<string | null>('cab-a12')
  const activeTool = ref<EditorTool>('select')
  const viewMode = ref<ViewMode>('3d')
  const viewportBackend = ref<ViewportBackend>('mock')
  const rightTab = ref<RightTab>('properties')
  const snapEnabled = ref(true)
  const collisionEnabled = ref(true)
  const measureEnabled = ref(false)
  const gridSize = ref(1.0)
  const canUndo = ref(true)
  const canRedo = ref(false)
  const toast = ref('')
  const placePreview = ref<{ asset: MockAsset; x: number; z: number } | null>(null)
  const wallLines = ref<Array<{ x1: number; z1: number; x2: number; z2: number }>>([])
  const wallDraft = ref<{ x: number; z: number } | null>(null)

  const overlays = reactive({
    upload: false,
    aiImage: false,
    interior: false,
    aiLayout: false,
    publish: false,
    runtimePreview: false
  })

  const selected = computed(() => nodes.value.find(n => n.id === selectedId.value) ?? null)

  function showToast(msg: string) {
    toast.value = msg
    window.setTimeout(() => {
      if (toast.value === msg) toast.value = ''
    }, 2200)
  }

  function selectNode(id: string | null) {
    selectedId.value = id
    if (id) rightTab.value = 'properties'
  }

  function setTool(tool: EditorTool) {
    activeTool.value = tool
    const label = TOOLS.find(t => t.id === tool)?.label ?? tool
    showToast(`当前工具：${label}`)
  }

  function undo() {
    canRedo.value = true
    canUndo.value = false
    showToast('已撤销')
  }

  function redo() {
    canUndo.value = true
    canRedo.value = false
    showToast('已重做')
  }

  function removeSelected() {
    if (!selectedId.value) return
    nodes.value = nodes.value.filter(n => n.id !== selectedId.value)
    selectedId.value = nodes.value[0]?.id ?? null
    showToast('已删除选中')
  }

  function duplicateSelected() {
    const src = selected.value
    if (!src) return
    const copy: MockNode = {
      ...src,
      id: `node-${++nodeSeq}`,
      name: `${src.name} 副本`,
      x: src.x + 0.6,
      z: src.z + 0.4,
      bindings: src.bindings.map(b => ({ ...b, spark: [...b.spark] })),
      events: src.events.map(e => ({ ...e }))
    }
    nodes.value = [...nodes.value, copy]
    selectedId.value = copy.id
    showToast('已复制')
  }

  function rotateSelected() {
    const n = selected.value
    if (!n) return
    n.yawDeg = (n.yawDeg + 90) % 360
    showToast('旋转 +90°')
  }

  function addAsset(asset: MockAsset) {
    assets.value = [asset, ...assets.value]
    showToast(`已导入资产：${asset.name}`)
  }

  function placeAsset(asset: MockAsset, x: number, z: number) {
    let px = x
    let pz = z
    if (snapEnabled.value) {
      const g = gridSize.value
      px = Math.round(px / g) * g
      pz = Math.round(pz / g) * g
    }
    if (collisionEnabled.value) {
      const hit = nodes.value.some(
        n => Math.abs(n.x - px) < (n.w + asset.w) / 2 && Math.abs(n.z - pz) < (n.d + asset.d) / 2
      )
      if (hit) {
        showToast('碰撞：放置被拒绝')
        placePreview.value = null
        return
      }
    }
    const node: MockNode = {
      id: `node-${++nodeSeq}`,
      name: asset.name,
      assetId: asset.id,
      category: asset.category,
      x: px,
      z: pz,
      yawDeg: 0,
      w: asset.w,
      d: asset.d,
      h: asset.h,
      description: `由「${asset.name}」放置`,
      location: '电气室 A › 草稿',
      status: 'online',
      color: asset.thumb,
      bindings: createDefaultBindings(),
      events: []
    }
    nodes.value = [...nodes.value, node]
    selectedId.value = node.id
    placePreview.value = null
    showToast(`已放置 ${asset.name}${snapEnabled.value ? '（已吸附）' : ''}`)
  }

  function applyLayoutPlan(planId: string) {
    const plan = AI_LAYOUT_PLANS.find(p => p.id === planId)
    if (!plan) return
    nodes.value = nodes.value.map(n => {
      const off = plan.offsets[n.id as keyof typeof plan.offsets] as { x: number; z: number } | undefined
      return off ? { ...n, x: off.x, z: off.z } : n
    })
    overlays.aiLayout = false
    showToast(`已应用 ${plan.name}`)
  }

  function updateSelected(patch: Partial<MockNode>) {
    const id = selectedId.value
    if (!id) return
    nodes.value = nodes.value.map(n => (n.id === id ? { ...n, ...patch } : n))
  }

  function toggleBinding(key: string, label: string, unit?: string) {
    const n = selected.value
    if (!n) return
    const exists = n.bindings.find(b => b.key === key)
    if (exists) {
      n.bindings = n.bindings.filter(b => b.key !== key)
    } else {
      n.bindings = [
        ...n.bindings,
        {
          key,
          label,
          alias: label,
          unit,
          value: '—',
          spark: Array.from({ length: 12 }, (_, i) => 30 + ((i * 7) % 40))
        }
      ]
    }
  }

  function addEventRule(rule: Omit<MockEventRule, 'id'>) {
    const n = selected.value
    if (!n) return
    n.events = [...n.events, { ...rule, id: `ev-${Date.now()}` }]
  }

  function removeEventRule(id: string) {
    const n = selected.value
    if (!n) return
    n.events = n.events.filter(e => e.id !== id)
  }

  function addWallPoint(x: number, z: number) {
    if (!wallDraft.value) {
      wallDraft.value = { x, z }
      showToast('墙起点已落点，再点终点')
      return
    }
    wallLines.value = [
      ...wallLines.value,
      { x1: wallDraft.value.x, z1: wallDraft.value.z, x2: x, z2: z }
    ]
    wallDraft.value = { x, z }
    showToast('已添加墙段')
  }

  function endWallChain() {
    wallDraft.value = null
    showToast('结束画墙')
  }

  return {
    ROOM,
    assets,
    nodes,
    selectedId,
    selected,
    activeTool,
    viewMode,
    viewportBackend,
    rightTab,
    snapEnabled,
    collisionEnabled,
    measureEnabled,
    gridSize,
    canUndo,
    canRedo,
    toast,
    placePreview,
    wallLines,
    wallDraft,
    overlays,
    showToast,
    selectNode,
    setTool,
    undo,
    redo,
    removeSelected,
    duplicateSelected,
    rotateSelected,
    addAsset,
    placeAsset,
    applyLayoutPlan,
    updateSelected,
    toggleBinding,
    addEventRule,
    removeEventRule,
    addWallPoint,
    endWallChain
  }
}

export type UxDemoState = ReturnType<typeof createUxDemoState>
