# @mh/3d-editor 架构定稿（D1–D7）

本文档约束 `@mh/3d-editor` 的长期形状。与 `_dev` legacy 包（engine / extensions / presets 四分法等）**无关**；以当前 monorepo 的 `packages/3d-editor` + Host apps 为准。

相关评审背景见 [architecture-review-2026-08.md](./architecture-review-2026-08.md)。

---

## D1. Document 是唯一权威

真相源是 `EditorDocument`，不是 Three 场景树。

- undo/redo 只有 `doc.history` 一套；可用 `history.transaction(label, fn)` 合并一批命令
- 3D gizmo / 2D 拖拽结束后只写回 `doc.commands.*`（如 `transformNode`），不另起历史栈
- 选中以 **nodeId** 为准；视口只做 nodeId ↔ `Object3D` 映射
- 节点业务态（含 `props`）变更后，视口经 `AssetHandle.apply`（或 rebuild 兜底）跟 Document，Host **禁止**手搓 `applyToObject` 补丁

**为何：** 曾以 Object3D 与 Document 双真相、双历史并行，必炸。

---

## D2. 复合资产用嵌套解析

Catalog 分两型：`model`（GLB / procedural）与 `document`（整份 container JSON，如柜内布局）。

- 场景放置「柜」类 document 资产时，3D 加载其 container document，再递归实例化柜内元件
- 寻址：`setNodeVisualState('柜节点/元件id', …)` 支持元件级高亮
- 深度上限 2：场景 → 柜 → 元件
- 发布把资产钉成 `(id, version)` 快照（`buildPublishBundle` / PackCatalog），监控端不回活库

**这是「能看到柜子里面」的产品根基。**

---

## D3. 单包 API 面 + 包内 3D Runtime

Host 只依赖 `@mh/3d-editor` + peer `three`（资产另装 `@mh/3d-editor-assets`）。主入口是 `createEditor`；不绑 Vue/React；viewport 工厂不是主公共面。

行业语义、Host UI 只出现在 `apps/*`。禁止 `apps → packages` 反向依赖。

**意图：** 一个内核包搞定编辑会话；不再拆 engine / extensions / presets 互相拖。

---

## D4. 墙体 = 线段墙

schema 只有 `structure.walls`（`a` / `b` / `height` / `thickness`），没有多边形房间类型。矩形房间是便捷 API（多段墙），不是另一种数据模型。

---

## D5. 碰撞内建，细则约束可选

- `placeItem` / `transformNode` / `duplicateNode` 内建 AABB 碰撞，重叠则 `denied`
- `ConstraintEngine` 为可选扩展（Host `register`）
- **注意：** AABB 当前不读 `scale`——「开了碰撞却像没开」时先查 scale

---

## D6. MVP 2D 交互约定

2D 是布局工具，不是俯视预览：连续画墙、拖放落点、fixture 贴墙、封闭环填地板、拖墙联动端点等由内核 2D viewport 承担。

---

## D7. 会话级交互配置

`createEditor({ interaction })`：`snapEnabled` / `collisionEnabled` / `transformModes` 等，运行时可改。会话吸附是 2D **贴边对齐**，不是硬网格一格一格跳。

---

## 命令面摘要（与 D1 配套）

| API | 作用 |
|-----|------|
| `doc.commands.placeItem` | 放置 |
| `doc.commands.duplicateNode` | 深拷贝 props/children，单条历史 |
| `doc.commands.transformNode` / `updateNode` / `removeNode` | 变换 / 属性 / 删除 |
| `doc.commands.*Wall*` / `setBounds` / `setEnvironment` | 结构与环境 |
| `doc.history.undo` / `redo` / `transaction` | 历史 |

编辑一律走命令；`EditorDocumentJSON` 由 Host 落库。schema 迁移另议，不在本定稿展开。

---

**一句话：** D1–D3 是引擎骨架（谁说了算、资产怎么嵌、怎么发包）；D4–D7 是电柜室类 MVP 的编辑语义（墙、碰撞、2D、会话开关）。
