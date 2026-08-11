# `@3d-editor/editor`

与 UI 框架无关的 **2D / 3D 编辑器内核 SDK**。

| 职责 | 非职责 |
|------|--------|
| Document 合同 + 命令 / 历史 / 选中 | 壳 UI、路由、落库 |
| Catalog 接口 + 内存 / 发布包实现 | 行业语义（电柜、机床等） |
| 2D Canvas + 3D（包内 ThreeRuntime）投影 | MQTT / 条件引擎 / 业务 action |

架构定稿：[docs/architecture.md](../../docs/architecture.md)。评审向用法：[docs/sdk-guide.md](../../docs/sdk-guide.md)。

---

## 安装

```bash
pnpm add @3d-editor/editor
pnpm add three@>=0.158   # peer
```

```ts
import {
  createEditor,
  createMemoryCatalog,
  createEmptyDocumentJSON,
  CATALOG_ITEM_MIME
} from '@3d-editor/editor'
import type { CatalogItem, EditorDocumentJSON, EditorSession } from '@3d-editor/editor'
```

类型与值分条导入。

---

## 适用场景

| 场景 | `kind` | 要点 |
|------|--------|------|
| 房间 / 车间俯视 | `scene` | 画墙、放设备、门窗贴墙 |
| 柜 / 设备内立面 | `container` | 元器件在宽×高平面摆放 |
| 只读 3D 监控 | 任意 | `viewport3d.readonly` + `setNodeVisualState` |
| 复合资产 | scene 嵌 document 柜 | 3D 展开深度上限 2 |

---

## 最小接入

```ts
const draft = createEmptyDocumentJSON({
  kind: 'scene',
  name: '车间',
  bounds: { width: 20, depth: 15, height: 3 }
})
// Host 自行 api.save(draft)

const editor: EditorSession = await createEditor({
  catalog: createMemoryCatalog(items),
  document: draft,
  mount: { canvas2d: el2d, canvas3d: el3d },
  onDenied: reason => console.warn(reason)
})

editor.viewport2d?.setTool('wall')
await api.save(editor.toJSON())
editor.dispose()
```

规则：

1. 真相源是 `EditorDocumentJSON`（Host 落库）与运行时 `editor.document`。
2. 编辑一律 `doc.commands.*`；撤销走 `doc.history`。
3. 2D / 3D 共享同一 `document`；`mount` 传哪些容器就挂哪些视口。
4. `node.props` 为不透明业务袋；`VisualState` 只做运行时呈现、不落库。

素材拖放：Host 在 `dragstart` 写入 `CATALOG_ITEM_MIME`，并调用 `viewport2d.beginExternalDrag(item)`。

---

## 公共导出面

按 Host 实际需要收窄；包内实现类与内部工具不再从根入口导出。

### 值（必用）

| 导出 | 说明 |
|------|------|
| `createEditor` | 推荐唯一入口 |
| `createEmptyDocumentJSON` | 空合同草稿 |
| `createMemoryCatalog` | 默认内存 Catalog（标注类型用 `CatalogProvider`） |
| `CATALOG_ITEM_MIME` | 拖放 MIME |

### 值（按场景）

| 导出 | 场景 |
|------|------|
| `buildPublishBundle` / `createPackCatalog` | 发布静态包 / 只读加载 |
| `SCHEMA_VERSION` | 手写或迁移 JSON（`createEmptyDocumentJSON` 已写入） |
| `createDefaultEnvironment` / `createDefaultWall` / `cloneEnvironment` | 环境面板 |
| `isDocumentItem` | 嵌套柜 document 型素材 |
| `instantiateProceduralModule` | 管理页裸预览（日常用 `createEditor({ procedural })`） |

### 类型（合同与会话）

会话：`CreateEditorOptions` · `EditorSession` · `EditorInteractionOptions` · `EditorInteractionState` · `TransformMode`

Document：`EditorDocumentJSON` · `EditorDocument` · `EditorNodeJSON` · `DocumentKind` · `EnvironmentJSON` 及子字段 · `VisualState` · `PlaceOptions` / `PlaceResult` 等

Catalog：`CatalogItem` · `CatalogProvider` · `CatalogQuery` · `FootprintSpec` · `Model3DSpec` · procedural 相关 · `PublishBundle`

视口 / 交互：`Viewport2D` · `Viewport3D` · `Tool2D` · `NodeInteractionEvent` 等（仅类型标注）

### 明确不导出

`createDocument` / Viewport 工厂 / `ThreeRuntime`、**`MemoryCatalog` / `PackCatalog` 类**、`buildAssetPack`、`catalogKey`、`createDefaultTransform` / `cloneTransform` / `createDefaultFloor`、碰撞与约束注册实现等。

---

## 会话进阶

延迟挂载与交互调参仍走 `createEditor`：

```ts
const editor = await createEditor({
  catalog,
  document: draft,
  interaction: {
    snapEnabled: true,
    collisionEnabled: false,
    transformModes: ['translate', 'rotate'] // 含 scale 会强制关碰撞
  },
  viewport3d: {
    readonly: false,
    onInteraction: e => console.log(e.type, e.nodePath)
  }
})

editor.mountCanvas2d(el2d)
editor.mountCanvas3d(el3d)
editor.setTransformMode('rotate')
editor.getInteraction()
```

发布：

```ts
const bundle = await buildPublishBundle(editor.document.toJSON(), catalog)
// 落库后只读：createPackCatalog(bundle.assetPack)
```

环境（进历史）：

```ts
const env = cloneEnvironment(editor.document.environment)
env.helpers = { grid: true, enclosure: 'openBox' }
editor.document.commands.setEnvironment(env)
```

**Scale ↔ 碰撞**：AABB 按 catalog `footprint`，不读 `node.scale`；白名单含 `scale` 时强制关碰撞。布局编辑默认不要开 scale。

---

## Document / Catalog / Viewport（摘要）

**Document**

```ts
doc.commands.placeItem / transformNode / removeNode / updateNode
doc.commands.addWall / removeWall / setBounds / setEnvironment
doc.history.undo() / redo()
doc.selection.set(id) / clear()
doc.createRectRoom(...)  // scene 四段墙快捷
doc.toJSON()
```

**Catalog**：Host 注入 `CatalogProvider`；`model3d` 为 `gltf` | `primitive` | `procedural`。procedural 日常经 `createEditor({ procedural: { resolve } })`；`document` 型须在 `get()` 时内联 `document`。

**2D**：`setTool('select' | 'wall')`、外部拖放、`fitBounds`、贴边吸附（会话 `snapEnabled`）；画墙端点磁吸始终可用。

**3D**：`setNodeVisualState` / `clearVisualStates`、`focusSelection`、`onCameraPoseChange`、性能 Info / 悬停描边。嵌套路径：`cabinetId/childId`。

三分法：指针手势（`onInteraction`）≠ 高亮（`VisualState`）≠ 业务绑定（`node.props`）。

---

## Document JSON（存盘）

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

Schema 变更走 semver；breaking 升本包 major。

---

## 包结构

```
packages/editor/src/
  core/        createEditor · EditorSession
  document/    Schema · 命令 · 历史 · 选中 · 碰撞
  catalog/     CatalogProvider · 内存 / 发布包
  viewport/    canvas2d · three · interaction-events
  index.ts     窄面公共导出
```

---

## 测试（维护指引）

| 层级 | 文件 | 建议 |
|------|------|------|
| 合同 / 命令 | `document/__tests__/document.test.ts` · `environment.test.ts` | **必留** — 命令、历史、碰撞、环境默认 |
| 会话 | `core/__tests__/interaction.test.ts` | **必留** — snap / collision / scale 互斥 |
| 发布 | `catalog/__tests__/publish.test.ts` · `procedural.test.ts` | **必留** — assetPack 与 procedural 钉版本 |
| 2D 纯函数 | `viewport/canvas2d/utils/__tests__/*` | **建议留** — 吸附、闭环、墙拖、落点默认；改几何时防回归 |
| 3D 辅助 | `viewport/three/helpers/__tests__/world-view-gizmo.test.ts` | **可留** — 体量小；改角标再动 |

不在公共面上的 `buildAssetPack` 等仍可在测试内直接相对路径引用。新功能 / 修 bug 优先补上述「必留」层。

```bash
pnpm --filter @3d-editor/editor test
```

---

## 相关文档

- [docs/architecture.md](../../docs/architecture.md) — 架构定稿  
- [docs/sdk-guide.md](../../docs/sdk-guide.md) — 用法与交互细则  
- [docs/reading-guide.md](../../docs/reading-guide.md) — 源码阅读顺序  
- 宿主范例：`apps/electrical-room`
