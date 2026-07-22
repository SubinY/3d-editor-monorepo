# 3D 编辑器 Monorepo

基于 Three.js 的多模块 3D 编辑器底座（TypeScript + pnpm + Turborepo）。

## 文档（唯一入口）

- [架构设计](./docs/architecture.md) — 分层、包职责、Preset / 插件、运行时流程
- [项目阅读指南](./docs/reading-guide.md) — 阅读顺序、入口、约定、日常改哪里

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
| `packages/engine` | `@3d-editor/engine` | 内核 |
| `packages/extensions` | `@3d-editor/extensions` | 插件与 kit |
| `packages/presets` | `@3d-editor/presets` | 场景 Preset / Runtime |
| `apps/demo-vue3` | — | 主演示 |
| `apps/demo-view` | — | 视图演示 |
