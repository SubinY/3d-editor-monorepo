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
| `isDocumentItem` | 嵌套柜 document 型素材 |
| `instantiateProceduralModule` | 管理页裸预览 |

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

## 相关

- 仓库说明：根目录 `README.md` / `AGENTS.md`
- 联调宿主：`apps/electrical-room`
