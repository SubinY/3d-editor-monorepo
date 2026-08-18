# electrical-room-api

Express JSON 落盘。产品主路径只保留 **layout + bootstrap + twin 模拟**。

## 职责

| 模块 | 文件 | 说明 |
|------|------|------|
| 编辑主面 | `editor-routes.ts` | scenes / containers 的 layout、bootstrap；`/api/comm` |
| 孪生模拟 | `twin-routes.ts` | `/api/twin/points` HTTP + `/api/twin/ws` |
| 落盘 | `store.ts` | documents / 站点通信清单 |

## 编辑合同

- 电气室 / 电柜 **分命名空间**，业务 id 可撞号。
- Document 为布局真相源（只存 `catalogRef`）。
- **左侧素材 / 回显解析**：Host `CatalogProvider`（`list` = placeable，`get` = 按需拉 layout）。
- **bootstrap**：返回 `document` + `room`/`cabinet`；scene 另带 `containerLayouts`（依赖柜 layout，避免 Host N+1）。不含 CatalogItem。

### 落盘

| 实体 | 路径 |
|------|------|
| scene | `data/documents/scenes/{roomId}.json` |
| container | `data/documents/containers/{cabinetId}.json` |
| 通信清单 | `data/comm.json`（站点级，不分室/柜） |

### API（均为 ApiEnvelope：`{ code, data, msg }`，twin 除外）

| 方法 | 路径 |
|------|------|
| GET/PUT/DELETE | `/api/editor/scenes/:roomId/layout` |
| GET/PUT/DELETE | `/api/editor/containers/:cabinetId/layout` |
| GET | `/api/editor/scenes/:roomId/bootstrap` → `{ document, room, containerLayouts }` |
| GET | `/api/editor/containers/:cabinetId/bootstrap` → `{ document, cabinet }` |
| GET | `/api/editor/scenes` / `/api/editor/containers` → `data.items` |
| GET/POST | `/api/twin/points` |
| WS | `/api/twin/ws` |
| GET | `/api/health` |
| GET/PUT | `/api/comm` → `{ version: 1, sources }` |

PUT body：`{ id, name, document }`（完整 `EditorDocumentJSON`）。校验 path/body/document 的 id 与 kind。  
GET 无记录：`document: null`。  
`containerLayouts`：本 scene 已引用柜的 layout 原文（key = 业务柜 id）；无档为 `null`。

Catalog CRUD、Publish、Settings、AI 模型工厂已从本服务移除；见仓库 `docs/electrical-room-backlog.md`。

## 环境变量

复制 `.env.example` 为 `.env`（可选）：

```bash
PORT=8787
```
