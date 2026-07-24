# @3d-editor/extensions 能力文档

`@3d-editor/extensions` 在 `@3d-editor/engine` 之上提供可复用的能力模块，按职责分为：

- `plugins/`（插件型）：直接接入 `EnginePlugin` 生命周期，可以在渲染循环中执行逻辑；包含吸附（Snap）、性能监控（Performance）、时间轴（Timeline + `TimelinePlayer`）。
- `kit/`（工具型）：提供物理、地图、路径、粒子、文本、后处理、材质等数据与助手，供业务层没必要依赖 `EnginePlugin` 也能复用。

## 插件型能力（`plugins/`）

1. `createSnapPlugin(options)`：在 `onTransform` 中自动对当前对象的位置与旋转进行格点/角度吸附，`options` 支持 `gridSize`、`angleStep`、`enabled`。
