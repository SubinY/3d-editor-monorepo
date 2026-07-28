# `@3d-editor/editor`

通用 **2D / 3D 编辑器内核 SDK**（与 Vue / React 无关）。

- **真相源**：可序列化的 `EditorDocumentJSON` + 运行时 `EditorDocument`（命令 / 历史 / 选中）
- **推荐入口**：`createEditor`（组装 Document + 可选 2D / 3D Viewport）
- **资产**：外部 `CatalogProvider`（包内提供内存实现）
- **不包含**：壳 UI、路由、落库、行业语义（电柜 / 机床等只出现在 Host）

架构定稿见仓库 [`docs/architecture.md`](../../docs/architecture.md)。

---

## 安装

```bash
pnpm add @3d-editor/editor
# peer
pnpm add three@>=0.158
```

```ts
import { createEditor, createMemoryCatalog, createEmptyDocumentJSON } from '@3d-editor/editor'
import type { CatalogItem, EditorDocumentJSON } from '@3d-editor/editor'
```

类型与值分条导入：`import type { ... }`。

---

## 适用场景

| 场景 | `DocumentKind` | 说明 |
|------|----------------|------|
| 房间 / 车间俯视布局 | `scene` | 画墙、放设备、门窗柱贴墙 |
| 柜 / 设备内立面 | `container` | 元器件在宽 × 高平面摆放 |
| 只读 3D 监控预览 | 任意 | `viewport3d.readonly: true` + `setNodeVisualState` |
| 复合资产 | scene 放 document 型柜 | 3D 嵌套展开 container（深度上限 2） |

---

## 核心模型

```
EditorDocumentJSON  ◄── toJSON / load ──►  EditorDocument
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                    Viewport2D            Viewport3D           Host UI
                   (Canvas 2D)          (ThreeRuntime)     (props / 告警)
                         │                    │
                         └────────► doc.commands.* ◄────────┘
```

规则：

1. Host 持有**一个** `document`；2D / 3D 共享同一引用。
2. 编辑一律走 `doc.commands.*`；undo / redo 只在 `doc.history`。
3. `node.props` 不透明业务袋（点位 / 事件配置由 Host 约定，内核不解释）。
4. `VisualState` 是运行时呈现，**不落库**。

---

## 公共导出面

### 值

| 导出 | 说明 |
|------|------|
| `createEditor` | 创建会话（推荐唯一入口） |
| `createMemoryCatalog` / `MemoryCatalog` | 内存 Catalog |
| `createEmptyDocumentJSON` | 空合同草稿（供 Host 落库） |
| `SCHEMA_VERSION` | 当前 `'1.0.0'` |
| `CATALOG_ITEM_MIME` | 拖放 MIME：`application/x-catalog-item` |
| `createDefaultTransform` / `cloneTransform` | 变换工具 |
| `createDefaultEnvironment` / `createDefaultFloor` / `createDefaultWall` / `cloneEnvironment` | 3D 环境工具 |
| `isDocumentItem` / `catalogKey` | Catalog 辅助 |

### 类型（节选）

| 分类 | 类型 |
|------|------|
| 会话 | `CreateEditorOptions` · `EditorSession` · `EditorInteractionOptions` · `EditorInteractionState` · `TransformMode` |
| Document | `EditorDocumentJSON` · `EditorDocument` · `EditorNodeJSON` · `DocumentKind` · `BoundsJSON` · `WallJSON` · `TransformJSON` · `EnvironmentJSON` · `VisualState` · `PlaceOptions` · `PlaceResult` · … |
| Catalog | `CatalogItem` · `CatalogProvider` · `CatalogCategory` · `Model3DSpec` · `FootprintSpec` · … |
| 视口 | `Viewport2D` · `Viewport3D` · `Tool2D` · `Viewport2DOptions` · `Viewport3DOptions` · `FocusCameraOptions` |
| 交互 | `InteractionEventType` · `NodeInteractionEvent` · `NodeInteractionHandler` |

### 不导出（内部积木）

`createDocument` / `loadDocument` / `create2DViewport` / `create3DViewport` / `ThreeRuntime` / 碰撞与约束注册实现等——仅供 `createEditor` 内部使用。

---

## 简单配置（开箱即用）

一次 `createEditor` + `mount`。默认：`snapEnabled` / `collisionEnabled` 开启；3D gizmo 仅 `translate`。

```ts
import {
  createEditor,
  createMemoryCatalog,
  createEmptyDocumentJSON,
  CATALOG_ITEM_MIME
} from '@3d-editor/editor'
import type { CatalogItem, EditorSession } from '@3d-editor/editor'

const items: CatalogItem[] = [
  {
    id: 'box-a',
    version: '1',
    name: '设备 A',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width: 0.8, depth: 0.6, height: 2 },
    model3d: { type: 'primitive', primitive: 'box', size: [0.8, 2, 0.6], color: '#4da3ff' }
  }
]

const draft = createEmptyDocumentJSON({
  kind: 'scene',
  name: '车间',
  bounds: { width: 20, depth: 15, height: 3 }
})

const editor: EditorSession = await createEditor({
  catalog: createMemoryCatalog(items),
  document: draft,
  mount: {
    canvas2d: document.getElementById('el2d')!,
    canvas3d: document.getElementById('el3d')!
  },
  onDenied: reason => console.warn(reason) // 如 collision:对方名称
})

// 画墙
editor.viewport2d?.setTool('wall')

// 素材拖放：Host 在 dragstart 写入 MIME，并通知 2D 预览
function onDragStart(ev: DragEvent, item: CatalogItem) {
  ev.dataTransfer?.setData(CATALOG_ITEM_MIME, JSON.stringify(item))
  editor.viewport2d?.beginExternalDrag(item)
}
function onDragEnd() {
  editor.viewport2d?.endExternalDrag()
}

// 撤销 / 保存 / 销毁
editor.document.history.undo()
const json = editor.toJSON() // Host 自行 api.save(json)
editor.dispose()
```

只挂 2D 或只挂 3D：`mount` 只传对应容器即可；双视图共享同一 `editor.document`。

---

## 复杂配置（延迟挂载 + 交互 + 监控）

低层工厂不对外暴露。「复杂」= 延迟 mount、会话交互调参、只读预览、环境命令、节点交互与运行时高亮。

```ts
import {
  createEditor,
  createMemoryCatalog,
  createEmptyDocumentJSON,
  cloneEnvironment
} from '@3d-editor/editor'
import type { NodeInteractionEvent, VisualState } from '@3d-editor/editor'

const draft = createEmptyDocumentJSON({
  kind: 'container',
  name: '柜体 A',
  bounds: { width: 0.8, depth: 0.6, height: 2 }
})

const editor = await createEditor({
  catalog: createMemoryCatalog(items),
  document: draft, // 也可以传入已落库的 EditorDocumentJSON
  // 不传 mount：路由 / DOM 就绪后再挂
  interaction: {
    snapEnabled: true,
    collisionEnabled: false, // 柜内允许重叠
    transformModes: ['translate', 'rotate'] // 含 'scale' 会强制关碰撞
  },
  viewport3d: {
    readonly: false,
    onInteraction: (e: NodeInteractionEvent) => {
      // click | dblclick | longpress（3D 先行；2D 未对齐）
      console.log(e.type, e.nodePath, e.nodeId)
    }
  },
  onDenied: reason => toast(reason)
})

// —— 挂载 ——
editor.mountCanvas2d(el2d)
editor.mountCanvas3d(el3d)

// —— 会话交互 ——
editor.setSnapEnabled(true)        // 2D 贴边对齐（懒生效，不回扫已有节点）
editor.setCollisionEnabled(false)
editor.setTransformModes(['translate', 'rotate'])
editor.setTransformMode('rotate')  // 须在白名单内
editor.getInteraction()            // 读生效态

editor.viewport2d?.setTool('select')
editor.viewport2d?.setRulersVisible(true)
editor.viewport2d?.fitBounds()

// —— 3D 呈现（进历史；可用 { history: false } 静默）——
const env = cloneEnvironment(editor.document.environment)
env.helpers = { grid: false, enclosure: 'openBoxDoubleDoor' }
env.background = { type: 'color', value: '#0c1420' }
env.floor.visible = false
editor.document.commands.setEnvironment(env)

// —— 发布静态包（预览/监控与活 Catalog 解耦）——
const bundle = await buildPublishBundle(editor.document.toJSON(), catalog)
// Host 落库后：createPackCatalog(bundle.assetPack) 作为只读 Catalog

// —— 监听 Document ——
editor.document.on('change', () => {
  // 刷新 Host 属性面板 / 图层树
})
editor.document.on('selection:changed', ({ ids }) => {
  const node = ids[0] ? editor.document.getNode(ids[0]) : undefined
})

// —— 业务扩展写入 props（内核不解释）——
editor.document.commands.updateNode(nodeId, {
  props: {
    bindings: [{ id: 'pt1', key: 'temp', alias: '柜温' }],
    events: [
      {
        id: 'ev1',
        kind: 'condition',
        when: { pointKey: 'temp', op: 'gt', value: 60 },
        then: { highlight: 'fault' },
        enabled: true
      }
    ]
  }
})

// —— 只读预览 / 运行时高亮 ——
// 另开会话时：
const preview = await createEditor({
  catalog,
  document: savedJson,
  mount: { canvas3d: elPreview },
  viewport3d: {
    readonly: true,
    onInteraction: e => openDetail(e.nodePath)
  }
})
preview.viewport3d?.setNodeVisualState('nodeId', {
  color: '#ff4d4f', // Host 语义色；省略 / null = 还原
  intensity: 1
} satisfies VisualState)
// 嵌套柜内元件：'cabinetNodeId/childNodeId'
preview.viewport3d?.clearVisualStates()

// —— 相机位姿（编辑态 Orbit 可静默回写 defaultView）——
const off = editor.viewport3d?.onCameraPoseChange(pose => {
  // pose.position / target / radius
})
off?.()

editor.dispose()
```

### Scale ↔ 碰撞互斥

AABB 按 catalog `footprint` 计算，**不读** `node.scale`：

- `transformModes` 含 `'scale'` → 强制 `collisionEnabled = false`
- 去掉 `'scale'` → 按 `collisionPreference` 恢复
- 布局编辑默认不要开 scale

---

## Document API（运行时）

```ts
const doc = editor.document

doc.kind / doc.id / doc.name / doc.bounds / doc.environment
doc.collisionEnabled
doc.getNodes()
doc.getNode(id)
doc.getWall(id)
doc.createRectRoom({ height: 3, thickness: 0.24 }) // scene：四段墙快捷创建
doc.toJSON()

doc.history.undo() / redo() / canUndo / canRedo
doc.selection.set(id) / clear() / first() / get()

doc.commands.placeItem(item, { position, rotation, name, props, select })
doc.commands.transformNode(id, { position, rotation, scale })
doc.commands.removeNode(id)
doc.commands.updateNode(id, { name, visible, props })
doc.commands.addWall(a, b, { height, thickness })
doc.commands.removeWall(id)
doc.commands.setBounds({ width, depth, height })
doc.commands.setEnvironment(env, { history?: boolean })
```

`placeItem` / `transformNode` 可能返回 `{ denied: 'collision:…' }`；也会经 `onDenied` 通知（视口拖放路径）。

---

## Catalog

```ts
interface CatalogItem {
  id: string
  version: string
  name: string
  placeableIn: ('scene' | 'container')[]
  footprint: { width: number; depth: number; height?: number }
  category?: 'wall' | 'fixture' | 'equipment' | 'component'
  model3d?: Model3DSpec          // model 型
  document?: EditorDocumentJSON  // document 型（内联）
  documentUrl?: string           // document 型（外链）
  shell3d?: Model3DSpec          // 柜壳
  thumb?: string
  metadata?: Record<string, unknown>
}

type Model3DSpec =
  | { type: 'gltf'; url: string }
  | { type: 'primitive'; primitive: 'box'; size: [number, number, number]; color?: string }
```

- `fixture`：2D 放置靠近墙时贴墙吸附  
- `document` 型：3D 嵌套解析内部 nodes（路径 `parentId/childId`）

---

## Viewport 要点

### 2D（`editor.viewport2d`）

| API | 说明 |
|-----|------|
| `setTool('select' \| 'wall')` | 选择 / 连续画墙 |
| `beginExternalDrag` / `endExternalDrag` | 外部素材拖放预览 |
| `placeItemAt` / `clientToWorld` | 程序化落点 |
| `fitBounds` / `setRulersVisible` / `setSnapEnabled` | 视图与吸附 |
| `resize` / `dispose` | 生命周期 |

画墙：左键连续落点，右键 / Esc 结束；端点磁吸始终可用（不受会话 `snapEnabled` 影响）。

### 3D（`editor.viewport3d`）

| API | 说明 |
|-----|------|
| `setNodeVisualState(path, state)` | 运行时高亮 |
| `clearVisualStates()` | 清除高亮 |
| `onCameraPoseChange(handler)` | Orbit 位姿变化 |
| `setTransformMode` / `setTransformModes` | gizmo（只读写会话时由 Session 转发） |
| `setPerfStatsVisible(boolean)` | 左下角性能 Info（物体/顶点/三角形/渲染时间）；亦可 `viewport3d.perfStats` |
| `setHoverOutlineEnabled(boolean)` | 悬停 Edges/Line2 描边；默认开（`viewport3d.hoverOutline`） |
| `focusSelection` / `focusNode(path)` | 沿当前视线框住包围盒（不写 `defaultView`） |

`VisualState`（纯呈现，无业务枚举；色值由 Host 传入）：

```ts
{ color?: string | null; intensity?: number }
// 有 color → 发光高亮；省略 / null → 还原材质
```

交互事件（`viewport3d.onInteraction`）：

```ts
type InteractionEventType = 'click' | 'dblclick' | 'longpress' | 'hover'
```

悬停描边为几何边缘线（非 `EffectComposer` / `OutlinePass`）。渲染时间 = 本帧 `render` 前后耗时（EMA + 约 250ms 刷新一次）。

---

## Document JSON 合同（存盘）

```ts
interface EditorDocumentJSON {
  schemaVersion: string
  kind: 'scene' | 'container'
  id: string
  name: string
  unit: 'm'
  bounds: { width: number; depth: number; height?: number }
  structure?: { walls?: WallJSON[] }
  nodes: EditorNodeJSON[]
  environment: EnvironmentJSON
  metadata?: Record<string, unknown>
}
```

- **Host 落库** `EditorDocumentJSON`；内核不内置存储。  
- Schema 变更走 semver；breaking 升 `@3d-editor/editor` major。  
- `environment`：背景 / 灯 / 阴影 / 地面 / 墙材质 / `helpers` / `defaultView`。

---

## 三分法：交互 · 高亮 · 业务绑定

| 能力 | API / 位置 | 落库 |
|------|------------|------|
| 指针手势 | `onInteraction`（3D） | 否 |
| 告警 / 状态高亮 | `setNodeVisualState({ color, intensity })`（色语义由 Host 定） | 否 |
| 点位 / 条件事件配置 | `node.props`（Host 约定） | 是 |

内核不实现 MQTT、条件引擎或业务 action 总线。

---

## 包结构

```
packages/editor/src/
  core/                 # createEditor · EditorSession · 交互配置
  document/             # Schema · 命令 · 历史 · 选中 · 碰撞
  catalog/              # CatalogProvider · MemoryCatalog
  viewport/
    canvas2d/           # 2D 投影
    three/              # 3D 投影 + ThreeRuntime
    interaction-events.ts
  index.ts              # 窄面公共导出
```

---

## 相关文档

- [`docs/architecture.md`](../../docs/architecture.md) — 架构定稿  
- [`docs/sdk-guide.md`](../../docs/sdk-guide.md) — 评审向用法说明  
- [`docs/reading-guide.md`](../../docs/reading-guide.md) — 源码阅读顺序  
- 宿主范例：`apps/electrical-room`
