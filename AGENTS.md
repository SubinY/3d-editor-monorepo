# Repository Guidelines

对外 npm 包：`@mh/3d-editor`（内网 `@mh` scope）。`apps/electrical-room*` 仅作本地联调。

架构定稿（D1–D7）：[`docs/architecture.md`](docs/architecture.md)。

## Structure

- `packages/3d-editor` — `createEditor`、Document、Catalog、2D/3D Viewport
- `packages/3d-editor-assets` — 通用 / 行业 procedural 资产
- `packages/3d-editor-twin` — 可选孪生绑定（`props.twin` / DataSource / TwinPlayer）
- `apps/electrical-room` — Host UI
- `apps/electrical-room-api` — JSON 落盘

依赖：`apps → @mh/3d-editor`（peer `three`）；禁止反向。行业语义只出现在 apps。孪生绑定按需依赖 `@mh/3d-editor-twin`。

## Commands

```bash
pnpm install
pnpm dev      # editor + host + api
pnpm build    # @mh/3d-editor
pnpm test
pnpm lint
pnpm version:patch   # 或 minor / major
pnpm run publish     # build + npm publish @mh/3d-editor
```

## Style

- TypeScript；Prettier：2 空格、无分号、单引号
- `camelCase` / `PascalCase` / 文件 `kebab-case`
- `import type` 与值导入分条
- 编辑走 `doc.commands.*`；`EditorDocumentJSON` 由 Host 落库

## Testing

Vitest（`packages/3d-editor`、`packages/3d-editor-twin` 内 `*.test.ts`）。改公共面时同步对应 README。
