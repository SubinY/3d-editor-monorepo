# electrical-room-api

Express JSON 落盘。日常编辑只依赖 **layout + bootstrap**；Catalog / Publish / AI 为演示旁路。

## 职责

| 模块 | 文件 | 说明 |
|------|------|------|
| 编辑主面 | `editor-routes.ts` | scenes / containers 的 layout、bootstrap |
| 旁路 | `side-routes.ts` | AI 模型工厂、`/catalog`、`/publishes`、settings |
| 落盘 | `store.ts` | documents / catalog / publishes 文件 |

## 编辑合同

- 电气室 / 电柜 **分命名空间**，业务 id 可撞号。
- Document 为布局真相源（只存 `catalogRef`）；业务柜保存 **不** 双写 Catalog。
- **左侧素材 / 回显解析**：Host `CatalogProvider`（`list` = placeable，`get` = 按需拉 layout）。
- **bootstrap**：返回 `document` + `room`/`cabinet`；scene 另带 `containerLayouts`（依赖柜 layout，避免 Host N+1）。不含 CatalogItem。

### 落盘

| 实体 | 路径 |
|------|------|
| scene | `data/documents/scenes/{roomId}.json` |
| container | `data/documents/containers/{cabinetId}.json` |

### 日常编辑 API（均为 ApiEnvelope：`{ code, data, msg }`）

| 方法 | 路径 |
|------|------|
| GET/PUT/DELETE | `/api/editor/scenes/:roomId/layout` |
| GET/PUT/DELETE | `/api/editor/containers/:cabinetId/layout` |
| GET | `/api/editor/scenes/:roomId/bootstrap` → `{ document, room, containerLayouts }` |
| GET | `/api/editor/containers/:cabinetId/bootstrap` → `{ document, cabinet }` |
| GET | `/api/editor/scenes` / `/api/editor/containers` → `data.items`（demo 列表） |

PUT body：`{ id, name, document }`（完整 `EditorDocumentJSON`）。校验 path/body/document 的 id 与 kind。  
GET 无记录：`document: null`。  
`containerLayouts`：本 scene 已引用柜的 layout 原文（key = 业务柜 id）；无档为 `null`。不是 CatalogItem。

### 旁路（非日常编辑）

| 区域 | 路径前缀 |
|------|----------|
| Catalog CRUD | `/api/catalog` |
| Publish | `/api/scenes/:id/publish`、`/api/publishes` |
| Settings | `/api/settings` |
| AI 模型工厂 | `/api/ai/model-factory/*`、`/models/*` |

---

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
KIMI_API_KEY=
KIMI_MODEL=kimi-k3
KIMI_BASE_URL=https://api.moonshot.cn/v1
PORT=8787
```

## AI 模型工厂

| 方法 | 路径 |
|------|------|
| POST | `/api/ai/model-factory/generate` |
| GET/PUT | `/api/ai/model-factory/drafts/:id` |
| POST | `/api/ai/model-factory/preview-build` |
| POST | `/api/ai/model-factory/publish` |
| GET | `/models/...` |
