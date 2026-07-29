# 3D Editor Monorepo — 架构设计

本文描述仓库的分层职责、依赖关系、核心抽象与对外发包策略。实现以源码为准。

## 1. 目标与边界

**目标**：提供通用的 **2D/3D 编辑器底座**（`@3d-editor/editor`），业务团队（电柜监控、工厂产线、园区等）通过注入 Catalog / 约束 / 自建壳 UI 搭出自己的编辑器产品；编辑产物为与渲染无关的 Document JSON，可进入监控预览等运行时形态。

**非目标**：

- 主包不承载任何行业语义（电柜、机床等名词不得进入公共 API）
- 不发布 editor-shell：布局、路由、业务表单由 Host（业务应用）控制
- 资产不耦合在编辑器包内：经 `CatalogProvider` 注入（当前内存实现，后期可换 CDN/HTTP）

## 2. 仓库形态

pnpm workspaces + Turborepo 的 TypeScript monorepo。

| 包 / 应用 | 名称 | 职责 |
|-----------|------|------|
| `packages/editor` | `@3d-editor/editor` | **对外唯一必选包**：`createEditor`、Document、Catalog、2D/3D Viewport、包内 ThreeRuntime |
| `packages/engine` | `@3d-editor/engine` | **legacy**：旧 3D 运行时；不再被 editor 依赖或 re-export |
| `packages/extensions` | `@3d-editor/extensions` | **legacy**：可选插件；peer 仍指向 editor（本轮未跟进新 API） |
| `packages/presets` | `@3d-editor/presets` | **legacy**：可选场景装配 |
| `apps/electrical-room` | electrical-room | 电柜业务 Host 范例（待按 `createEditor` 迁移） |
| `apps/demo-vue3` | demo-vue3 | 旧演示（直连 engine） |
| `apps/demo-view` | demo-view | 视图向演示 |

依赖方向（单向、禁止反向）：

```
apps ──► @3d-editor/editor（peer: three）
         （engine / presets / extensions 为 legacy，不在新主路径）
```
## 3. 关键架构决策（定稿）

### D1. Document 是唯一权威（历史 / 命令 / 选中）

- `EditorDocument` 的命令栈是**唯一 undo/redo 来源**；Host 只调 `doc.history.undo()/redo()`。
- 3D gizmo 结束只写回 Document，**不**维护第二套历史。
- 选中以 **nodeId** 为准；3D viewport 内部维护 nodeId ↔ Object3D 双向映射：
  - 3D 拾取 → nodeId → `doc.selection.set(nodeId)`
  - gizmo 拖拽结束 → `doc.commands.transformNode(nodeId, next)`（先过约束，拒绝则回滚对象）
  - document 变更事件 → 映射回 Object3D 增删/更新
### D2. 复合资产（如电柜）：嵌套解析

- `CatalogItem` 两型：`model` 型（`model3d` 指向 GLB / 内置几何 / Host `procedural` id）；`document` 型（`document` / `documentUrl` 指向一份 ContainerDocument JSON）。
- 3D viewport 遇 `document` 型条目时**嵌套解析**：加载 container JSON，递归实例化内部元件；外壳优先级为 `gltf shell3d` > 内层 `environment.helpers.enclosure` > 其它 `shell3d`（半透明），与柜资产编辑态 enclosure 对齐。
- **程序化模型**：`model3d: { type: 'procedural', id }` 可 JSON 序列化；几何由 Host 经 `createEditor({ procedural: { resolve } })` 注入。无 resolve / 解析失败时回退 footprint 盒子。行业几何不进 editor 包。
- 运行时寻址：柜内元件路径为 `sceneNodeId/childNodeId`，`setNodeVisualState(path, state)` 支持柜内元件级高亮。
- 防护：解析深度上限 2 层（场景→柜→元件）；2D 视图对 `document` 型只画 footprint 占位。
- **发布静态化（Host）**：编辑与 `/preview` 走已保存 `EditorDocumentJSON` + 活 Catalog；场景发布生成 `assetPack` 内容快照；**仅监控首页 `/home`** 用 `createPackCatalog(assetPack)`。柜资产按 `(id, version)` 钉死；场景拖放取最新 version 写入 `catalogRef`。

### D3. 发包拓扑：单 API 面 + 包内 3D Runtime

- Host **只装** `@3d-editor/editor` + peer `three`。
- 推荐入口：`createEditor`；`EditorDocumentJSON` 由 Host 落库（API / 文件；electrical-room 经 `electrical-room-api` JSON 落盘）。
- 3D 管线为 editor 内自维护的 `ThreeRuntime`（不再依赖 / re-export `@3d-editor/engine`）。
- 不对外导出 `createDocument` / `loadDocument` / `create2DViewport` / `create3DViewport`（Session 内部使用）。
- 主包不绑 vue/react。
### D4. 墙体模型：线段墙

- schema 只有 `structure.walls`（线段墙 `a/b/height/thickness`），无 polygon 表达。
- 矩形房间 = `doc.createRectRoom()` 快捷创建四段墙（API 便利层，不是另一种数据表达）。

### D5. MVP 约束模型：内建 AABB 碰撞，细则约束降级为可选

- 内核在 `placeItem` / `transformNode` 内建 **AABB 物体碰撞**（footprint + yaw 近似，见 `document/collision.ts`）：同层级节点重叠即拒绝，denied 形如 `collision:<对方名称>`；经 `createEditor` 的 `interaction.collisionEnabled` / `session.setCollisionEnabled` 控制（底层为 `doc.collisionEnabled`）。
- **Scale ↔ 碰撞互斥**：`transformModes` 含 `'scale'` 时强制关碰撞（AABB 不读 `node.scale`）；开碰撞会从白名单剔除 scale。详见 [sdk-guide.md](./sdk-guide.md)。
- `ConstraintEngine` 保留但**降级为可选扩展点**：会话吸附**不**自动注册网格约束（避免拖拽量化）；Host 若需要硬网格可自行 `doc.constraints.register(gridSnapConstraint(...))`（约束 API 仍为包内能力，非公共导出面）。
- `bounds` 仅表达工作区/柜体尺寸（container 强边界感，scene 作画布参考，不强制「墙外禁放」）。
- 柜体尺寸可中途修改：`doc.commands.setBounds(next)` 进历史，viewport 监听 `bounds:updated` 刷新。

### D6. MVP 2D 交互约定

- **连续画墙**：`tool='wall'` 时左键连续落点成链，右键 / Esc 结束当前链；落点 0.1m 网格吸附 + 既有端点磁吸（便于闭合）；墙段带米制长度标注（一位小数）。画墙吸附**不受**会话 `snapEnabled` 影响。
- **拖放落点**：Host 在素材 `dragstart` 写入 `CATALOG_ITEM_MIME`，并调用 `viewport2d.beginExternalDrag(item)`（因 dragover 读不到 getData，用于 footprint 悬浮预览）；画布内置 `drop` 在指针世界坐标处 `placeItem`；也可用 `placeItemAt` / `clientToWorld` 自组装。`dragend` 时调 `endExternalDrag()`。
- **门窗柱 = 可放置节点，非开洞布尔**：`CatalogItem.category: 'fixture'` 的条目放置时若距最近墙 < 阈值，位置投影到墙段、朝向贴墙。
- **封闭墙填地板**：端点聚类后提取封闭环，2D/3D 运行时填充地板（不写入 Document schema）。
- **2D 拖墙**：可选中墙拖墙身平移或拖端点改形；共享端点（吸附阈值内）联动邻墙；fixture 不跟随。
- `CatalogItem.category`（`wall | fixture | equipment | component`）供 Host 左侧素材分组与交互语义（fixture 触发贴墙吸附）。

### D7. 会话级交互配置

- `createEditor({ interaction })`：`snapEnabled`（默认 true，懒生效）、`collisionEnabled`（默认 true）、`transformModes`（默认 `['translate']`）。
- 运行时：`setSnapEnabled` / `setCollisionEnabled` / `setTransformModes` / `setTransformMode` / `getInteraction()`。
- 会话吸附 = 2D **贴边**对齐（物件四边、轴对齐墙内外表面）；不注册硬网格约束，避免拖拽一格一格跳。
- 3D gizmo 仅允许白名单内 mode；布局默认不开 scale。

### 次级定稿

| 项 | 决策 |
|----|------|
| VisualState | `viewport3d.setNodeVisualState(nodeIdPath, { color?, intensity? })`；有 color 则发光，省略/null 还原；**只作用于该 path 自身网格（含柜壳），不进入嵌套子 path**；**无业务 status 枚举**（色义由 Host 映射） |
| 3D 交互事件 | `viewport3d.onInteraction`：`click` / `dblclick` / `longpress` / `hover`（`NodeInteractionEvent`）；**2D 本期未对齐** |
| 性能 Info | `setPerfStatsVisible` / `viewport3d.perfStats`：左下角物体/顶点/三角形/渲染时间（会话态；EMA + 低频刷新） |
| 悬停描边 | EdgesGeometry + Line2（非 EffectComposer）；`viewport3d.hoverOutline` 默认开 |
| 聚焦选中 | `focusSelection` / `focusNode`：沿当前视线 fit bbox，不写 `defaultView` |
| 只读预览 | `createEditor({ viewport3d: { readonly: true, onInteraction } })`，不另设 createViewer |
| props | `node.props` 不透明业务袋（点位/事件配置由 Host 约定）；内核不解释 |
| environment | Document 同级契约字段；背景/灯/阴影/helpers/defaultView；经 `commands.setEnvironment` |
| camera 交互位姿 | `defaultView` 存类型/目标/位姿种子与距离限制；编辑态 Orbit 变化可静默回写目标与半径（不入历史）；无阻尼，操作立刻到位 |
| 约束时机 | 交互（place/transform）强制（内建碰撞 + 可选规则）；`loadDocument` 只校验产出警告列表，不阻塞加载 |
| unit | schema 保留 `unit: 'm'` 但为常量（当前仅米制） |
| 2D 技术 | Canvas 2D（自管命中测试），非 SVG |

## 4. Document Schema（存盘与跨团队交换主格式）

`EditorDocumentJSON` 定义于 `packages/editor/src/document/types.ts`：

```ts
interface EditorDocumentJSON {
  schemaVersion: string          // 开发期字段戳；当前不做按版本迁移
  kind: 'scene' | 'container'    // 按编辑拓扑，不按行业
  id: string
  name: string
  unit: 'm'                      // 常量
  bounds: { width: number; depth: number; height?: number }
  structure?: {
    walls?: Array<{              // 线段墙（D4）
      id: string
      a: [number, number]        // 俯视 XZ 起点
      b: [number, number]
      height?: number
      thickness?: number
    }>
  }
  nodes: EditorNodeJSON[]
  environment: EnvironmentJSON   // 3D 呈现：背景/灯/阴影/地面/grid|openBox/defaultView
  metadata?: Record<string, unknown>   // 非契约扩展
}

interface EnvironmentJSON {
  background: { type: 'color'; value: string } | { type: 'equirect'; url: string }
  lights: Array<{
    type: 'ambient' | 'directional'
    color?: string
    intensity?: number
    position?: [number, number, number]
    castShadow?: boolean
  }>
  shadows: { enabled: boolean; type?: 'basic' | 'pcfsoft' }
  helpers: { grid: boolean; enclosure: 'none' | 'openBox' | 'openBoxDoor' | 'openBoxDoubleDoor' | 'outdoorCabinet' }
  /** 场景地面；单套材质；coverage 控制 bounds 或仅闭合墙区 */
  floor: {
    visible: boolean
    coverage: 'bounds' | 'closedRooms'
    color: string
    opacity?: number
    presetId?: string
    mapUrl?: string
    mapRepeat?: number
  }
  /** 场景墙体外观；所有墙共用一套材质 */
  wall: {
    color: string
    opacity?: number
    presetId?: string
    mapUrl?: string
    mapRepeat?: number
  }
  defaultView?: {
    /** orbit=旋转相机；orthographic=正交平面图 */
    type?: 'orbit' | 'orthographic'
    position: [number, number, number]
    target: [number, number, number]
    /** orbit：FOV(°)；orthographic：视窗高度（米） */
    fov?: number
    minDistance?: number
    maxDistance?: number
  }
}

interface EditorNodeJSON {
  id: string
  name?: string
  catalogRef?: { id: string; version: string }  // 外置资产引用，不 bake mesh
  transform: {
    position: [number, number, number]          // y 向上
    rotation: [number, number, number]
    scale: [number, number, number]
  }
  visible?: boolean
  children?: EditorNodeJSON[]
  props?: Record<string, unknown>               // 业务扩展，编辑器不解释
}
```

**与旧 `SceneSchema` 的关系**（`packages/engine/src/types.ts`）：

| | EditorDocumentJSON（新主格式） | SceneSchema（engine） |
|--|------------------------------|----------------------|
| 目的 | 跨视图编辑、跨团队存盘、资产引用 | Three 对象树几何/材质快照 |
| 资产 | `catalogRef`（model / document 两型） | 内联 geometry/material |
| 墙体 | `structure.walls` 一等公民 | 无 |
| 谁用 | `@3d-editor/editor` 主路径 | 旧 demo / 兼容导出 |

Document schema 变更走 semver；breaking 升 `@3d-editor/editor` major。

## 5. 2D/3D 共用同一 Document

```
EditorDocumentJSON ◄──load / toJSON──► EditorDocument（运行时）
                                          │            │
                             投影 footprint/墙      投影 GLB/嵌套解析/preset
                                          ▼            ▼
                                    2D Viewport    3D Viewport
                                          │            │
                              commands.place/move   gizmo → commands.transform
                                          └────► doc.commands.*（先过约束）
```

规则：

1. Host 创建**一个** `doc`，两个 viewport 传入**同一引用**。
2. 任一视图的编辑都走 `doc.commands.*`；document 变更事件驱动两视图刷新。
3. undo/redo 只存在于 document（D1）；保存只调 `doc.toJSON()`。
4. 禁止「2D/3D 各存一份 JSON」与「以 Object3D 为真相源反推 2D」。

## 6. editor 包结构

```
packages/editor/src/
  core/                 # createEditor / EditorSession
  document/             # Schema、门面、history/selection/events/serialize、collision、constraints
  catalog/
  viewport/canvas2d/    # Facade + services / utils
  viewport/three/       # Facade + services / utils + ThreeRuntime
  utils/
  index.ts              # 窄面公共导出
```

3D 由 `viewport/three/runtime/ThreeRuntime` 提供；旧 `packages/engine` 为 legacy。
Viewport 内：`utils/` 纯函数，`services/` 有状态职责；门面只做装配与事件路由。
3D 视口右下角有世界坐标轴角标（点 ±X/±Y/±Z 立刻切视角，角标内拖拽环绕相机）；不进 `environment.helpers`。

## 7. 平台 / 业务分工

| 平台提供（@3d-editor/editor） | 业务编写（Host） |
|------------------------------|-----------------|
| Document 内核、命令/历史/选中 | Shell UI（左中右、工具条、权限） |
| CatalogProvider 接口 + 内存实现 | Catalog 数据（柜型/元器件 或 机床/工位） |
| ConstraintEngine + 通用规则 | 行业约束（墙内放置、通道宽度…） |
| 双 Viewport + VisualState（color/intensity） | Inspector 表单；设备状态色表 → setNodeVisualState |
| 3D `onInteraction`（click/dblclick/longpress/hover）+ 悬停描边 / 聚焦 / 性能 Info | 点位/条件事件配置（`node.props`）与运行时求值；Host 快捷键（如 F） |
| EditorDocumentJSON 合同 | 运行时大屏（告警订阅 → Host 映射色 → setNodeVisualState） |

不同 DocumentKind 只有 `scene` / `container` 两种：工厂车间是 `scene`，设备内部模块是 `container`——**不新建 FactoryDocument**。

## 8. 接入最小形态

```ts
import { createEditor, createMemoryCatalog, createEmptyDocumentJSON } from '@3d-editor/editor'
import type { EditorDocumentJSON } from '@3d-editor/editor'

const draft = createEmptyDocumentJSON({ kind: 'scene', bounds: { width: 20, depth: 15 } })
// Host 自行 api.save(draft)

const editor = await createEditor({
  catalog: createMemoryCatalog(items),
  document: draft,
  mount: { canvas2d: el2d, canvas3d: el3d },
  onDenied: reason => toast(reason),
})
// 保存：editor.document.toJSON()；撤销：editor.document.history.undo()
```

详见 [sdk-guide.md](./sdk-guide.md)。

## 9. 验收宿主：apps/electrical-room

| 入口 | 行为 |
|------|------|
| `/` 列表页 | 电柜 / 电柜室两栏；创建表单（电柜填长宽高，电柜室填基本资料）、编辑 / 预览 / 删除入口 |
| `/edit/container/:id` 电柜编辑 | 柜体立体平面内拖放元器件；右侧可改柜尺寸（`setBounds`）；保存即发布为场景侧柜资产 |
| `/edit/scene/:id` 电柜室编辑 | 空画布起步：连续画墙圈房间、拖放电柜与门窗柱（贴墙吸附）；2D / 3D / 并排三种视图模式 |
| `/preview/:id?` 监控预览 | 只读加载**已保存草稿** + 活 Catalog；mock 告警高亮 |
| `/home` 监控首页 | 只读**发布包** PackCatalog（静态快照） |

业务代码边界：壳 UI（`views/manage` / `Workbench.vue`）、Catalog 合成（`business/catalog.ts`）、HTTP 客户端（`business/api.ts`）在 app 内；落盘由 `apps/electrical-room-api` 承担。MVP 后 demo 不再注册细则约束，仅依赖内核碰撞（D5）。

## 10. engine 内部层（3D 运行时）

engine 的既有抽象继续有效，经 editor re-export 对外：

- **CoreContext**：渲染循环、相机、控制器、选中、gizmo、事件总线的枢纽；新增 `history.autoRecordTransform` 选项（D1）
- **Preset 机制**：`ScenePreset` + `PresetManager`；`create3DViewport({ preset })` 注入
- **插件机制**：`EnginePlugin` 渲染前后/选中/变换钩子；`create3DViewport({ plugins })` 注入
- **序列化**：`SceneSerializer` + `SceneSchema`（兼容旧路径，不是新主存盘格式）

## 11. 演进方向

- Catalog CDN / HTTP Provider（接口已定，换实现即可）
- 2D 视图：墙体编辑增强（拖点、合并）、框选
- 迁移工具：`sceneSchemaToDocument` 一次性适配旧数据
- 更多可选 preset（campus / datacenter）
