# 3D 编辑器 Monorepo

基于 Three.js 的多模块 3D 编辑器底座（TypeScript + pnpm + Turborepo）。

## 文档（唯一入口）

- [架构设计](./docs/architecture.md) — 分层、包职责、定稿决策、Schema
- [SDK 架构与使用](./docs/sdk-guide.md) — **内核 npm 用法 + electrical-room 接入对照（评审用）**
- [项目阅读指南](./docs/reading-guide.md) — 阅读顺序、入口、约定

Agent 约定见根目录 `AGENTS.md`。

## 快速开始

```bash
pnpm install   # Node ≥18，pnpm ≥8
pnpm dev       # turbo 开发
pnpm build
pnpm test
pnpm lint
```

## 包一览

| 路径 | 包名 | 作用 |
|------|------|------|
| `packages/editor` | `@3d-editor/editor` | **对外必选包**：Document 内核 + Catalog + 2D/3D Viewport |
| `packages/engine` | `@3d-editor/engine` | 3D 运行时（内部实现包，被 editor 内置） |
| `packages/extensions` | `@3d-editor/extensions` | 可选插件与 kit（peer → editor） |
| `packages/presets` | `@3d-editor/presets` | 可选场景 Preset / Runtime（peer → editor） |
| `apps/electrical-room` | — | 电柜 Host：列表/创建表单 + 连续画墙 + 拖放碰撞 + 2D/3D |
| `apps/demo-vue3` | — | 旧主演示 |
| `apps/demo-view` | — | 视图演示 |

```bash
# 电柜示例（场景编辑 / 电柜编辑 / 监控预览）
pnpm --filter electrical-room dev   # http://localhost:5175
```
