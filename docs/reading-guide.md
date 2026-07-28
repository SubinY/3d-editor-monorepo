# 项目阅读指南

面向第一次进入本仓库的开发者与 Agent：按什么顺序读、关键入口在哪、日常任务改哪里。两分钟可扫完；细节跟源码。

## Overview

本仓库是基于 Three.js 的 **通用 2D/3D 编辑器 monorepo**。对外必选包是 `packages/editor`（`@3d-editor/editor`）：`createEditor` + Document + Catalog + 双 Viewport（3D 为包内 ThreeRuntime）。`packages/engine` / `presets` / `extensions` 为 legacy。电柜 Host 范例在 `apps/electrical-room`（待迁新 API）。

架构与定稿决策见 [architecture.md](./architecture.md)；**用法**见 [sdk-guide.md](./sdk-guide.md)。

- D1 唯一历史栈 · D2 复合资产嵌套解析 · D3 单包 + 包内 ThreeRuntime · D4 线段墙
- **D5 MVP**：内建 AABB 碰撞；细则 `ConstraintEngine` 降级为可选；scale↔碰撞互斥
- **D6 MVP**：连续画墙、拖放落点、门窗柱贴墙吸附（非开洞）
- **D7**：会话级 `snapEnabled` / `collisionEnabled` / `transformModes`（见 sdk-guide）
## Tech Stack

| Layer | Technology | Notes |
|-------|------------|--------|
| Language | TypeScript ~5.3 | Node ≥18，pnpm ≥8 |
| 3D | three ^0.160 | editor 的 peerDependency |
| 2D | Canvas 2D | `Viewport2D` 自管命中测试 |
| Apps | Vue 3 + Vue Router + Vite 5 | `electrical-room`、`demo-vue3`、`demo-view` |
| Monorepo | pnpm workspaces + Turborepo | 根脚本 `dev` / `build` / `test` / `lint` |
| Test | Vitest | `packages/editor` Document / 碰撞测试 |
| Publish | Changesets | `changeset` / `version` / `release` |

## 建议阅读顺序

1. 本文 + [architecture.md](./architecture.md)（分层、D1–D7、Schema）
2. [sdk-guide.md](./sdk-guide.md)（`createEditor` 简单/手动配置与交互 API）
3. `packages/editor/src/core/create-editor.ts`
4. `packages/editor/src/document/types.ts` + `EditorDocument.ts`
5. `packages/editor/src/viewport/canvas2d/Viewport2D.ts`
6. `packages/editor/src/viewport/three/Viewport3D.ts` + `runtime/ThreeRuntime.ts`
7. 按需：legacy `packages/engine`、`apps/electrical-room`（旧接入，待迁移）

## Key Entry Points

| 关注点 | 路径 |
|--------|------|
| **主包导出** | `packages/editor/src/index.ts` |
| createEditor | `packages/editor/src/core/` |
| Document | `packages/editor/src/document/` |
| Catalog | `packages/editor/src/catalog/` |
| 2D / 3D | `packages/editor/src/viewport/canvas2d/`、`viewport/three/` |

## Directory Map

```
packages/editor/src/        # ★ 对外必选包
  core/                     # createEditor
  document/                 # Schema + 运行时
  catalog/
  viewport/canvas2d/        # Facade + services / utils
  viewport/three/           # Facade + services / utils + runtime
apps/electrical-room/       # Host 范例（createEditor）
packages/engine|presets|extensions/  # legacy
```

## 一条完整链路（MVP）

### 电柜室

1. `/` → 创建电柜室（填名称）→ `/edit/scene/:id`
2. 左侧点「画墙」：2D 左键连续落点，右键 / Esc 结束链
3. 拖门/窗/柱到墙附近 → 贴墙吸附；拖电柜到画布 → AABB 碰撞拦截重叠
4. 顶栏切换 2D / 并排 / 3D；保存写 localStorage

### 电柜

1. `/` → 创建电柜（填长宽高）→ `/edit/container/:id`
2. 拖元器件到柜内平面；右侧可改柜体尺寸（`setBounds`）
3. 保存后自动作为场景侧 `equipment` Catalog 条目

### 预览

`/preview/:id` 只读 3D + mock 告警 → Host 色表映射后 `setNodeVisualState('柜/元件', { color })`

## Conventions

- **命名**：文件/目录 kebab-case；变量函数 camelCase；类与 Vue 组件 PascalCase；包名 `@3d-editor/*`
- **格式**：Prettier（2 空格、无分号、单引号）
- **编辑操作**：一律 `doc.commands.*`（内建碰撞 + 可选 ConstraintRule + 历史）
- **MVP 约束**：默认只靠 AABB 碰撞；不要在 Host 再塞 bounds/墙外禁放细则，除非产品明确要
- **行业语义**：不得进入 `@3d-editor/editor` 公共 API
- **依赖**：`apps → presets → extensions → editor → engine`，禁止反向

## Common Tasks

```bash
pnpm install
pnpm --filter electrical-room dev   # http://localhost:5175
pnpm --filter @3d-editor/editor test
pnpm build
```

## Where to Look

| 我想… | 去看… |
|--------|--------|
| 改碰撞 / setBounds / 命令 | `packages/editor/src/document/` |
| 改连续画墙 / 拖放 / 贴墙 / 拖墙 | `viewport/canvas2d/services/`、`utils/wall-snap.ts`（`applyWallDrag`）；门面 `Viewport2D.ts` |
| 改封闭地板 / 对齐线 | `viewport/canvas2d/utils/closed-loops.ts`、`align-guides.ts`；3D 地板在 `Viewport3D.rebuildFloors` |
| 改 3D 拾取 / gizmo 回写 | `viewport/three/services/selection.ts`、`transform-bridge.ts` |
| 改素材分组约定 | `CatalogCategory` in `catalog/types.ts`；条目在 `apps/.../catalog.ts` |
| 改列表 / 创建表单 / 编辑壳 UI | `apps/electrical-room/src/views/`、`components/Workbench.vue` |
| 加可选细则约束 | `document/constraints.ts`（可选；MVP 不必） |
| 理解决策 | [architecture.md](./architecture.md) D1–D6 |

## 已知缺口

- Catalog 当前仅内存；CDN/HTTP Provider 未做
- 门窗柱不做墙开洞布尔，仅为贴墙节点
- `demo-vue3` 仍走 engine 直连，未迁到 editor SDK
- 不强制「墙外禁放」；scene 的 `bounds` 作画布参考
