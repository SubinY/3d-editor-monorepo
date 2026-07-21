# @3d-editor/engine 使用指南

`@3d-editor/engine` 是封装在 Three.js 之上的 3D 编辑器内核，提供场景/渲染、选中/变换、历史、序列化与插件层，便于多业务快速搭建可组合的编辑器体验。

## 目录映射
- `runtime/`：`CoreContext`、渲染循环、相机、事件总线、插件管理、`EditorActions` 等运行时入口。
- `editing/`：控制器（Orbit/Transform）、射线选中、历史记录、场景树、对齐工具、辅助/高亮等编辑能力。
- `assets/`：几何/材质/光照工厂、`AssetLoader`、`AssetRegistry`。
- `io/`：`SceneSerializer`、DSL 拓展、`policies/`（统一判断可选中与可序列化）。
- 其他：`animation/`、`types.ts`、`utils.ts` 支持模块。