# 3D Editor Monorepo

`@3d-editor/editor` 内核 SDK 的 monorepo：本地联调 Host，可发布 npm。

## 结构

| 路径 | 说明 |
|------|------|
| `packages/editor` | npm 包 `@3d-editor/editor` |
| `apps/electrical-room` | 本地调试 Host（Vue） |
| `apps/electrical-room-api` | Host 落盘 API |

用法见 [`packages/editor/README.md`](./packages/editor/README.md)。

## 快速开始

```bash
# Node ≥18，pnpm ≥8
pnpm install
pnpm dev          # editor watch + Host + API
pnpm build        # 构建 @3d-editor/editor
pnpm test
```

- Host：http://localhost:5175  
- peer：Host 需安装 `three >= 0.158`

```
apps/*  →  @3d-editor/editor  →  peer three
```

## 发布 npm

先登录：`npm login`（发布的是 `@3d-editor/editor`）。

```bash
pnpm version:patch   # 或 version:minor / version:major（改 version + git tag）
pnpm run publish     # build 后 publish（须用 run，避免和 pnpm 内置 publish 混淆）
git push && git push --tags
```
