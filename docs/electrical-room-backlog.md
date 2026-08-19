# 电柜室 Host 备用能力清单

收口后产品主路径：电柜室 / 电柜编辑 + 预览（TwinPlayer）。下列能力**不在当前 Host / API 代码中**；接回从 git 历史取（删除前在 `feat/electrical-room-scope` 之前的提交）。

接回约束：导入 / AI 产物走「草稿 → 预览 → 可选进盘」；立面默认盘仍由白名单控制。

## P1

### 模型导入（glTF / 程序化工厂函数）

- 用途：接触器、端子排等换真模型；资产入库工作流。
- **已接回（Host P1）**：资源面板「导入模型」→ `AssetIngestModal` → 「我的素材」草稿盘；API `/api/assets/upload` + `/api/asset-drafts`。默认白名单仍静态。

### AI 生成 procedural 工厂函数

- 入口：同一 `AssetIngestModal`「看图生成」Tab（不复活 Manage ModelLab）。
- API：`/api/ai/model-factory/generate|preview-build|compile`；编译产物进「我的素材」，**不**进默认盘。
- 依赖：`electrical-room-api` 的 `KIMI_API_KEY`（或 `MOONSHOT_API_KEY`）。

## P2

### 发布冻结包 + 监控首页

- 原入口：`buildPublishBundle`、`/api/publishes`、`DashboardHome`、设为首页。
- **已接回（本分支）**：多版本发布落盘；前端 `/#/published/:sceneId/:version` 用 PackCatalog 播监控；列表页展示最新版本并可切换历史版本。
- 仍待接回：设为首页 / DashboardHome KPI 壳。
- 何时接回首页：需要离线监控壳、站点级首页配置时。

### 双开门 / 户外柜壳

- assets 的 `openBoxDoubleDoor` / `outdoorCabinet` resolver 仍在；Host 下拉已收为 `none | openBox | openBoxDoor`。
- 何时接回：drawcall / 拾取性能过关后。

## P3

### 目录扩容

- glowRing / alertBox / PLC / 电表 / 继电器：曾在默认盘或 demo 柜中，现仅 fallback 灰色盒子可解析旧 JSON。

### Catalog 活库

- 原 `/api/catalog` 与 Host `DemoCatalog` 双真相；日常编辑不依赖活库。
- 何时接回：有跨文档可复用、可版本化的资产条目时。
