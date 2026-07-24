# Repository Guidelines

本 monorepo 为 3D 编辑器内核与演示应用。架构与阅读顺序以文档为准，勿依赖已删除的零散文档。

## 必读文档

- `docs/architecture.md` — 架构设计（定稿决策 / Schema）
- `docs/sdk-guide.md` — 内核 npm 用法（`createEditor`）
- `docs/reading-guide.md` — 项目阅读指南

## Project Structure

- `packages/editor`：`@3d-editor/editor` **对外唯一必选包**（`createEditor`、Document、Catalog、2D/3D Viewport、包内 ThreeRuntime）
- `packages/engine` / `extensions` / `presets`：**legacy**（本轮不跟进新 editor API）
- `apps/electrical-room`：电柜业务 Host 范例（待迁 `createEditor`）
- `apps/demo-vue3`：旧演示（直连 engine）
- `apps/demo-view`：视图向演示
- `docs`：正式文档（上述三篇）

依赖方向：`apps → @3d-editor/editor`（peer `three`）；禁止反向。行业语义只能出现在 apps。

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
- **类型导入**：`import type { Foo } from '...'`，与值导入分条；公共面用 `export type`
- 编辑操作：一律 `doc.commands.*`（经 `createEditor` 获得 `editor.document`）
- Document schema（`EditorDocumentJSON`）由 Host 落库；变更走 semver；breaking 升 editor major

## Testing

- Vitest；`*.test.ts` / `*.spec.ts`
- 新功能与修 bug 应补测；与周边覆盖大致对齐即可

## Commits & PRs

- 提交信息祈使、聚焦（如 `add transform controls`、`fix selection bounding box`）
- PR 说明清晰；UI 变更附截图/GIF；确保 lint / test 通过

## Agent Notes

- 改架构认知时同步更新 `docs/architecture.md` / `docs/reading-guide.md`
- 最小 diff；不做任务范围外的大规模格式化
