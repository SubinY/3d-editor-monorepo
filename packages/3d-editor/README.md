# `@mh/3d-editor`

与 UI 框架无关的 **2D / 3D 编辑器内核 SDK**。

| 职责 | 非职责 |
|------|--------|
| Document 合同 + 命令 / 历史 / 选中 | 壳 UI、路由、落库 |
| Catalog 接口 + 内存 / 发布包实现 | 行业语义（电柜、机床等） |
| 2D Canvas + 3D（包内 ThreeRuntime）投影 | MQTT / 条件引擎 / 业务 action |

仓库联调宿主：`apps/electrical-room`。

---

## 安装

```bash
pnpm add @mh/3d-editor
pnpm add three@>=0.158   # peer
```

内网需配置 `@mh` 指向 Nexus（见仓库根 `.npmrc`）。

```ts
import {
  createEditor,
  createMemoryCatalog,
  createEmptyDocumentJSON,
  CATALOG_ITEM_MIME
} from '@mh/3d-editor'
import type { CatalogItem, EditorDocumentJSON, EditorSession } from '@mh/3d-editor'
```

类型与值分条导入。

---

## 适用场景

| 场景 | `kind` | 要点 |
|------|--------|------|
| 房间 / 车间俯视 | `scene` | 画墙、放设备、门窗贴墙 |
| 设备内立面 | `container` | 元器件在宽×高平面摆放 |
| 只读 3D 监控 | 任意 | `viewport3d.readonly` + `setNodeVisualState` + `onInteraction` 订阅 |
| 复合资产 | scene 嵌 document | 3D 展开深度上限 2 |

节点在各自 document 内**平铺**；嵌套只走 document 型 catalog（`catalogRef` → 另一份 JSON）。

### 空间壳 `helpers.enclosure`

开放字符串。内核只内建 `none` / `openBox`；`openBoxDoor`、`openBoxDoubleDoor`、`outdoorCabinet`、`screenBody`（屏体 GLB）等由 `@mh/3d-editor-assets` 的 `commonProceduralResolvers` 按同名 id 解析。container 新建默认 `openBox`。

---

## 最小接入

```ts
const draft = createEmptyDocumentJSON({
  kind: 'scene',
  name: '车间',
  bounds: { width: 20, depth: 15, height: 3 }
})

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
2. 编辑一律 `doc.commands.*`（含 `duplicateNode`）；撤销走 `doc.history`（可用 `transaction` 合并）。
3. 2D / 3D 共享同一 `document`；`mount` 传哪些容器就挂哪些视口。
4. `node.props` 为不透明业务袋；变更由视口 `AssetHandle` 同步到 3D。`VisualState` 只做运行时呈现、不落库：`setNodeVisualState` 改子树 albedo + emissive（`intensity` 控制强弱；`pulse` 时在渲染循环内 sine 闪烁）。
5. 架构硬约束见仓库根 [`docs/architecture.md`](../../docs/architecture.md)（D1–D7）。

素材拖放：Host 在 `dragstart` 写入 `CATALOG_ITEM_MIME`，并调用 `viewport2d.beginExternalDrag(item)`。

### 2D 重叠点选

按鼠标落点（非物体相交）：同一 `(u,v)` 落在 ≥2 个 footprint 内时，若提供 `viewport2d.onPickCandidates`，松手（未拖移）回调候选列表（上→下）；Host 弹面板后自行 `doc.selection.set(id)`。未提供回调时仍选最上层并拖。拖移超过约 5px 则拖已选中且在候选内的节点，否则拖最上层。

```ts
createEditor({
  document: draft,
  catalog,
  viewport2d: {
    onPickCandidates: ({ nodes, pointer }) => {
      // Host 在 pointer 处弹面板；选中后 selection.set(nodes[i].id)
    }
  }
})
```

---

## 公共导出面

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
| `SCHEMA_VERSION` | 手写或迁移 JSON |
| `createDefaultEnvironment` / `createDefaultWall` / `cloneEnvironment` | 环境面板 |
| `isDocumentItem` | 嵌套 document 型素材 |
| `instantiateProceduralModule` | 管理页裸预览 |
| `runProceduralResolvers` | 按序跑 `procedural.resolvers`（一般由 createEditor 内部调用） |

### 类型

会话、Document 合同、Catalog、视口与交互相关类型均从包根导出（见源码 `index.ts`）。

### 明确不导出

`createDocument` / Viewport 工厂 / `ThreeRuntime`、实现类、内部 defaults 等。

---

## 发布与测试

```bash
pnpm --filter @mh/3d-editor test
pnpm --filter @mh/3d-editor build
```

内网发布见仓库根 `README.md`（`pnpm run publish`）。

---

## ??

- ???????? `README.md` / `AGENTS.md`
- ?????`apps/electrical-room`

---

## environment.ceiling ?????

### ???? floor ???

`EnvironmentJSON.ceiling` ??? `floor` ???`visible` / `coverage`?`bounds` | `closedRooms`?/ `color` / `opacity` / `mapUrl` / `mapRepeat` / `presetId`?

- ???? **Y = `bounds.height`**
- ?? **`visible: false`**?? JSON ???? `fromJSON` ???
- ? `helpers.enclosure` **????**??????? `enclosure: 'none'` + ??? `wall` + `floor`/`ceiling` ???????? enclosure

```ts
import { cloneEnvironment } from '@mh/3d-editor'

const env = cloneEnvironment(doc.environment)
env.ceiling = {
  visible: true,
  coverage: 'bounds',
  color: '#2a3544',
  mapUrl: '/textures/ceiling/plaster.jpg',
  mapRepeat: 4,
  presetId: 'plaster'
}
env.helpers.enclosure = 'none'
doc.commands.setEnvironment(env)
```

### 3D 相机 `look`

Host 只调 `viewport3d.look(...)`，不要改 Three 相机或 Orbit。

| `at` | 含义 |
|------|------|
| `home` | 文档 `environment.defaultView`（复位） |
| `pose` | 显式 `DefaultViewJSON` |
| `top` | 正上方俯瞰，默认正交 + 框住场景 |
| `front` | 正面（+Z），默认正交 + 框住 bounds |
| `node` / `selection` | 框住节点 |
| `indoor` | 室内预设；`persist: true` 才写回 `defaultView` |

```ts
editor.viewport3d?.look({ at: 'home' })
editor.viewport3d?.look({ at: 'top' })
editor.viewport3d?.look({ at: 'front' })
editor.viewport3d?.look({ at: 'node', path: cabinetId })
editor.viewport3d?.look({ at: 'selection' }, { padding: 1.4 })
editor.viewport3d?.look({ at: 'indoor', persist: false })
// 只切正交、不改当前位姿
editor.viewport3d?.look({ at: 'home' }, { projection: 'orthographic', applyPose: false })
```

`createIndoorDefaultView(bounds)` / `createFrontDefaultView(bounds, { aspect })` 仍可用于手搓 `DefaultViewJSON`。只读投影：`getProjection()`。

### 离屏静帧 `captureSnapshop`

固定分辨率 PNG，不改用户 Orbit / 主画布尺寸。默认正面正交 512×768。

```ts
const blob = await editor.viewport3d?.captureSnapshop({
  at: 'front',
  projection: 'orthographic',
  width: 512,
  height: 768
})
```

### 3D 交互 `onInteraction`

指针交互（click / dblclick / longpress / hover）用订阅，对齐 `onCameraPoseChange`；不要在 `createEditor` 里传回调。

```ts
const off = editor.viewport3d?.onInteraction(event => {
  // event.nodePath / event.type / event.node
})
// 卸载时
off?.()
```
