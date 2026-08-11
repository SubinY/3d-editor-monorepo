# 3D Editor Monorepo

`@mh/3d-editor` 内核 SDK 的 monorepo：本地联调 Host，可发布到内网 Nexus。

## 结构

| 路径 | 说明 |
|------|------|
| `packages/editor` | npm 包 `@mh/3d-editor` |
| `apps/electrical-room` | 本地调试 Host（Vue） |
| `apps/electrical-room-api` | Host 落盘 API |

用法见 [`packages/editor/README.md`](./packages/editor/README.md)。

## 快速开始

```bash
# Node ≥18，pnpm ≥8
pnpm install
pnpm dev          # editor watch + Host + API
pnpm build        # 构建 @mh/3d-editor
pnpm test
```

- Host：http://localhost:5175
- peer：Host 需安装 `three >= 0.158`

```
apps/*  →  @mh/3d-editor  →  peer three
```

## 发布 npm（内网 Nexus）

确保已登录内网源（`.npmrc` 指向 Nexus），然后：

```bash
pnpm version:patch   # 或 version:minor / version:major
pnpm run publish     # build 后 publish（须用 run）
git push && git push --tags
```
