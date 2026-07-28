# `@3d-editor/editor` 内核架构与使用说明

面向评审：讲清 **npm 必选包做什么 / 不做什么**、**怎么用**。实现细节以源码为准；定稿决策见 [architecture.md](./architecture.md)。

---

## 1. 一句话定位

`@3d-editor/editor` 是 **与 UI 框架无关的 2D/3D 编辑器内核 SDK**：

- 真相源是 **Document**（可序列化 `EditorDocumentJSON` + 运行时命令/历史/选中）
- **推荐入口**是 `createEditor`（内部组装 Document + 可选 2D/3D Viewport）
- 资产来自外部 **Catalog**（接口 + 内存实现）
- **不提供**壳 UI、路由、落库——由 Host 自建；JSON 由 Host 存 DB / API（demo 可用 localStorage）

```bash
pnpm add @3d-editor/editor
# peer: three >= 0.158
```

> `packages/engine`、`packages/presets`、`packages/extensions` 为 **legacy**，本轮起不再作为 editor 必选依赖或 re-export。

---

## 2. 包适用场景

| 场景 | Document `kind` | 说明 |
|------|-----------------|------|
| 房间 / 车间俯视布局 | `scene` | 画墙、放设备 footprint、门窗柱贴墙 |
| 柜 / 设备内立面排布 | `container` | 元器件在宽×高平面摆放 |
| 只读 3D 预览 / 监控 | 任意 | `viewport3d.readonly: true`；`setNodeVisualState` 高亮 |
| 复合资产嵌套 | scene 放 document 型柜 | 3D 展开 container JSON（深度上限 2） |

行业语义（电柜、电视整机等）只出现在 Host Catalog / 路由 / 落库，不进入内核 schema。

---

## 3. 包内结构

```
packages/editor/src/
  core/           # createEditor / EditorSession / 交互配置
  document/       # 合同类型 + 运行时门面（history/selection/events/serialize…）
  catalog/
  viewport/
    canvas2d/     # 2D Canvas 投影（私有工厂）
    three/        # 3D 投影 + 自维护 ThreeRuntime
  utils/
  index.ts        # 窄面公共导出
```

依赖方向：`Host → @3d-editor/editor`（`three` 为 peer）。

---

## 4. 简单配置（推荐默认）

一次 `createEditor` + `mount` 即可开编。默认：`snapEnabled`、`collisionEnabled` 开启；3D gizmo 仅 `translate`。

```ts
import {
  createEditor,
  createMemoryCatalog,
  createEmptyDocumentJSON,
  CATALOG_ITEM_MIME,
} from '@3d-editor/editor'
import type { EditorDocumentJSON, CatalogItem } from '@3d-editor/editor'

const draft = createEmptyDocumentJSON({
  kind: 'scene',
  name: '车间',
  bounds: { width: 20, depth: 15, height: 3 },
})
await api.save(draft)

const catalog = createMemoryCatalog(items)
const editor = await createEditor({
  catalog,
  document: draft,
  mount: { canvas2d: el2d, canvas3d: el3d },
  onDenied: reason => toast(reason),
})

editor.document.history.undo()
editor.viewport2d?.setTool('wall')
await api.save(editor.toJSON())
editor.dispose()
```

Host 只需：Catalog、落库、素材拖放（`CATALOG_ITEM_MIME`）。

- 只 2D / 只 3D / 双视图：由 `mount` 传哪些容器决定；双视图共享同一 `editor.document`。
- 类型与值分条导入：`import type { ... }`。

### EditorDocumentJSON 与落库

| 形态 | 谁持久化 |
|------|----------|
| `EditorDocumentJSON` | **Host**（线上 API/DB；demo 可用 localStorage） |
| `EditorDocument` 运行时 | 不落库；由 `createEditor` hydrate |

内核**不**内置存储。

---

## 5. 手动配置（仍走 createEditor，Host 自建壳）

低层工厂（`createDocument` / Viewport 构造）**不对外导出**。「手动」= 延迟挂载 + 会话交互 API + Host 工具栏。

```ts
const editor = await createEditor({
  catalog,
  document: draft,
  // 不传 mount
  interaction: {
    snapEnabled: true,
    collisionEnabled: true,
    transformModes: ['translate', 'rotate'], // 需要缩放再加 'scale'（会关碰撞）
  },
  viewport3d: { readonly: false },
})

// 路由 / DOM 就绪后
editor.mountCanvas2d(el2d)
editor.mountCanvas3d(el3d)

editor.setSnapEnabled(false)           // 懒吸附：不回扫已有节点
editor.setCollisionEnabled(false)      // 允许重叠（柜内 / 模型内摆件）
editor.setTransformMode('rotate')      // 须在 transformModes 白名单内
editor.viewport2d?.setTool('wall')

// 3D 呈现（背景 / 灯 / 阴影 / 网格 / 开口盒）：走 Document 命令
editor.document.commands.setEnvironment({
  ...editor.document.environment,
  helpers: { grid: true, enclosure: 'none' },
  background: { type: 'color', value: '#0c1420' },
})
```

| API | 作用 |
|-----|------|
| `getInteraction()` | 读生效态：`snapEnabled` / `collisionEnabled` / `collisionPreference` / `transformModes` / `transformMode` |
| `setSnapEnabled` | 2D 贴边对齐（物件边 / 墙面）；**不**做硬网格量化；画墙端点吸附不受影响 |
| `setCollisionEnabled` | 写 Document AABB；与 scale **互斥**（见下） |
| `setTransformModes` | 改 3D gizmo 白名单 |
| `setTransformMode` | 切当前 mode；不在白名单则 no-op |
| `document.commands.setEnvironment` | 整对象替换 3D 呈现配置（进历史）；`createEmptyDocumentJSON` 已按 kind 写出默认 |

### Scale ↔ 碰撞互斥

当前 AABB 按 catalog `footprint` 计算，**不读** `node.scale`。因此：

- `transformModes` **含** `'scale'` → 强制 `collisionEnabled = false`（保留 `collisionPreference`）
- 从白名单 **去掉** `'scale'` → 按 preference 恢复碰撞
- `setCollisionEnabled(true)` 且白名单含 scale → 踢掉 scale；若当前 mode 是 scale 则回退 `translate`
- 创建时同时开 scale 与 collision → **scale 优先**，关碰撞并 `console.warn`

布局编辑默认不要加 scale；自由造型再开 scale，并接受无碰撞。

---

## 6. 公共导出 vs 不导出

**导出（值）：** `createEditor`、`createMemoryCatalog`、`createEmptyDocumentJSON`、`SCHEMA_VERSION`、`CATALOG_ITEM_MIME`、`createDefaultEnvironment`、`cloneEnvironment`

**导出（类型）：** `CreateEditorOptions`、`EditorSession`、`EditorInteractionOptions`、`EditorInteractionState`、`TransformMode`、合同类型（含 `EnvironmentJSON` / `BackgroundJSON` / `LightJSON`）、`CatalogItem`…、`InteractionEventType` / `NodeInteractionEvent` / `NodeInteractionHandler`、以及 `EditorDocument` / `Viewport2D` / `Viewport3D` **仅作类型标注**

**不导出：** `createDocument`、`loadDocument`、`create2DViewport`、`create3DViewport`、`ThreeRuntime`、commands/collision 实现、约束注册 API 等。积木仅供 `createEditor` 内部使用。

---

## 7. Document / Catalog / Viewport（摘要）

- **Document**：写操作走 `doc.commands.*`；历史 `doc.history`；选中 `doc.selection`；3D 呈现 `doc.commands.setEnvironment`；`node.props` 为不透明业务扩展。
- **Catalog**：Host 注入 `CatalogItem[]`；`model` / `document` 两型；`placeableIn` 必填。
- **碰撞**：内建 AABB；会话 `setCollisionEnabled` / `interaction.collisionEnabled`；`onDenied` 接收 `collision:…`。
- **吸附**：会话 `snapEnabled` 控制 2D 贴边对齐（懒生效）；画墙工具内置端点吸附始终可用。硬网格 `gridSnapConstraint` 仍可供 Host 自行注册，但不随会话吸附自动开启。
- **3D**：包内 `ThreeRuntime`；环境由 Document.environment 投影；`floor.coverage`：`bounds`（工作区）| `closedRooms`（仅闭合墙围合，不规则跟随墙）；`wall`：场景级墙色/贴图（所有墙共用）；`defaultView.type`：`orbit` | `orthographic`；`helpers.enclosure`：`none` | `openBox` | `openBoxDoor` | `openBoxDoubleDoor`。视口右下角世界坐标轴角标（点轴切视角 / 拖拽环绕，不进 helpers）。地板/墙体贴图由 Host 同源静态资源提供（`mapUrl` / `presetId`），内核不内置纹理文件。
- **交互事件 vs VisualState vs props**：`onInteraction` 只报告指针手势（`click` / `dblclick` / `longpress` / `hover`，3D 先行）；`setNodeVisualState({ color, intensity })` 是运行时呈现（不落库，色值由 Host 传入）；点位/条件规则与业务四态由 Host 写入 `props` 并自行映射，内核不解释。
- **3D 辅助**：`setPerfStatsVisible` / `viewport3d.perfStats` 开左下角性能 Info（物体/顶点/三角形/帧时；帧时高则卡顿，主要取决于三角面、材质、分辨率与主线程工作）；`hoverOutline` 默认开悬停描边（Edges/Line2，非后处理）；`focusSelection` / `focusNode` 沿当前视线框住选中（Host 可绑 `F`）。

---

## 8. 相关文档

- [architecture.md](./architecture.md)
- [reading-guide.md](./reading-guide.md)
