# 项目阅读指南

面向第一次进入本仓库的开发者与 Agent：按什么顺序读、关键入口在哪、日常任务改哪里。两分钟可扫完；细节跟源码。

## Overview

本仓库是基于 Three.js 的 **3D 编辑器 monorepo**。内核在 `packages/engine`，可插拔能力在 `packages/extensions`，场景装配在 `packages/presets`，Vue3 演示在 `apps/demo-vue3`（及 `demo-view`）。

架构全貌见 [architecture.md](./architecture.md)。

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|--------|
| Language | TypeScript ~5.3 | Node ≥18，pnpm ≥8 |
| 3D | three ^0.160 | peer / workspace 依赖 |
| Apps | Vue 3 + Vue Router + Vite 5 | `demo-vue3`、`demo-view` |
| Monorepo | pnpm workspaces + Turborepo | 根脚本 `dev` / `build` / `test` / `lint` |
| Test | Vitest（脚本已配） | packages 内测试文件目前很少或缺失 |
| Publish | Changesets | `changeset` / `version` / `release` |

## 建议阅读顺序

1. 本文 + [architecture.md](./architecture.md)（分层与依赖）
2. `packages/engine/src/runtime/CoreContext.ts`（枢纽）
3. `packages/engine/src/runtime/PresetManager.ts`（Preset 契约）
4. `packages/presets/src/presets/factory/`（装配 + runtime 范本）
5. `apps/demo-vue3/src/views/factory/composables/useEditor.ts`（应用如何接入）
6. 按需深入：`editing/`、`extensions/plugins/`、`io/SceneSerializer.ts`

## Key Entry Points

| 关注点 | 路径 |
|--------|------|
| 包导出（engine） | `packages/engine/src/index.ts` |
| 包导出（extensions） | `packages/extensions/src/index.ts` |
| 包导出（presets） | `packages/presets/src/index.ts` |
| 应用启动 | `apps/demo-vue3/src/main.ts` |
| 路由 | `apps/demo-vue3/src/router/index.ts`（`/factory`、`/editor`） |
| 工厂编辑器接入 | `apps/demo-vue3/.../useEditor.ts` → `createFactoryRuntime` |
| 场景协议类型 | `packages/engine/src/types.ts`、`dsl/schema.ts` |

## Directory Map

```
apps/
  demo-vue3/          # 主演示（工厂 + 通用编辑器）
  demo-view/          # 视图向演示
packages/
  engine/src/
    runtime/          # CoreContext、插件/Preset、动作、渲染循环
    editing/          # 选中、变换、历史、场景树、对齐、辅助
    assets/           # 几何/材质/灯光工厂与加载
    io/ + dsl/        # 序列化与扩展 schema
    policies/         # 可选中/可序列化策略
  extensions/src/
    plugins/          # snap / timeline / performance
    kit/              # 物理/地图/绘制等工具接口
  presets/src/
    presets/basic.ts
    presets/factory/  # preset/ 装配 + runtime/ 门面
docs/
  architecture.md     # 架构设计（本目录）
  reading-guide.md    # 本文
```

## 一条完整链路（工厂场景）

1. 浏览器进入 `/factory` → `FactoryEditor.vue`
2. `createEditor()` → `createFactoryRuntime({ initialFloorSize, ... })`
3. `init(container)` → 创建 `CoreContext`，应用 `factoryPreset`（地面、灯、相机、背景等）
4. UI：`registerComponent` / `spawn` / `setTool` / `save`
5. 内核：`actions` 写场景与历史，`selection` / `transform` 交互，`serializer` 持久化

## Conventions

- **命名**：文件/目录 kebab-case；变量函数 camelCase；类与 Vue 组件 PascalCase；包名 `@3d-editor/*`
- **格式**：Prettier（2 空格、无分号、单引号）；ESLint + `@typescript-eslint`
- **编辑操作**：优先 `ctx.actions.*`，避免绕过历史与事件总线
- **不可选对象**：辅助物体设 `userData.nonSelectable`（及必要时空 `raycast`）
- **依赖**：禁止 `extensions → presets`、禁止 `engine → apps`
- **Git**：当前工作树若无可用 git 历史，不臆造提交约定；见 `AGENTS.md` 中的 imperative 提交风格建议

## Common Tasks

```bash
pnpm install          # 安装
pnpm dev              # turbo 并行开发
pnpm build            # 全量构建
pnpm test             # Vitest（turbo）
pnpm lint             # ESLint
pnpm format           # Prettier
```

单包开发时进入对应 workspace 使用其 `dev` / `build`（多为 `vite build --watch`）。

## Where to Look

| 我想… | 去看… |
|--------|--------|
| 改选中 / 变换 / 撤销 | `packages/engine/src/editing/` |
| 改插件生命周期 | `packages/engine/src/runtime/PluginManager.ts` |
| 加吸附等插件 | `packages/extensions/src/plugins/` |
| 改工厂灯光/地面 | `packages/presets/src/presets/factory/preset/` |
| 改 spawn / 工具模式 | `packages/presets/src/presets/factory/runtime/` |
| 新场景风格 Preset | 仿 `factory/`：`preset/` + 可选 `runtime/` |
| 改演示 UI / 面板 | `apps/demo-vue3/src/views/` |
| 改序列化字段 | `packages/engine/src/types.ts`、`io/`、`dsl/` |
| 理解包边界 | [architecture.md](./architecture.md) |

## 已知缺口（读码时注意）

- `AGENTS.md` 若未及时更新，以本文与 `architecture.md` 及源码为准
- packages 内测试样例可能缺失：改内核时建议顺手补 `*.test.ts`
- `extensions/kit` 多为接口/脚手架，不等于开箱即用的完整物理/地图实现
