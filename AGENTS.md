# Repository Guidelines

本 monorepo 为 3D 编辑器内核与演示应用。架构与阅读顺序以文档为准，勿依赖已删除的零散文档。

## 必读文档

- `docs/architecture.md` — 架构设计
- `docs/reading-guide.md` — 项目阅读指南

## Project Structure

- `packages/engine`：`@3d-editor/engine` 内核（CoreContext、编辑、Preset 机制、序列化）
- `packages/extensions`：`@3d-editor/extensions` 插件（snap/timeline/performance）与 kit
- `packages/presets`：`@3d-editor/presets` 场景装配（basic、factory 等）
- `apps/demo-vue3`：主演示（工厂 / 通用编辑器）
- `apps/demo-view`：视图向演示
- `docs`：正式文档（仅上述两篇）

依赖方向：`apps → presets → extensions → engine`（禁止反向）。

## Build, Test & Development

- Install: `pnpm install`（Node ≥18，pnpm ≥8）
- Dev: `pnpm dev`
- Build: `pnpm build`
- Test: `pnpm test`（Vitest / turbo）
- Lint: `pnpm lint`
- Format: `pnpm format`

## Coding Style & Naming

- TypeScript 优先；避免不必要的 `any`
- Prettier：2 空格、无分号、单引号（`.prettierrc.js`）
- 命名：`camelCase` 变量/函数，`PascalCase` 类型/类/组件，文件目录 `kebab-case`
- 编辑操作优先 `ctx.actions.*`；辅助物体使用 `userData.nonSelectable`

## Testing

- Vitest；`*.test.ts` / `*.spec.ts`
- 新功能与修 bug 应补测；与周边覆盖大致对齐即可

## Commits & PRs

- 提交信息祈使、聚焦（如 `add transform controls`、`fix selection bounding box`）
- PR 说明清晰；UI 变更附截图/GIF；确保 lint / test 通过

## Agent Notes

- 改架构认知时同步更新 `docs/architecture.md` / `docs/reading-guide.md`
- 最小 diff；不做任务范围外的大规模格式化
