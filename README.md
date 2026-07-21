# 3D 编辑器 Monorepo

基于 Three.js 的多模块编辑器内核，目标是提供一个可即插即用、可自定义的 3D 编辑器底座，供工厂、建筑、孪生等场景复用。

## 仓库结构概览
- `packages/engine`：内核包 `@3d-editor/engine`，按功能划分为：
  - `runtime/`：`CoreContext`、渲染循环、相机、事件总线、插件管理、`EditorActions` 等运行时基础；
  - `editing/`：控制器、射线选中、历史记录、场景树、对齐工具、辅助图元、高亮效果；
  - `assets/`：几何/材质/光源工厂、资源加载与注册器；
  - `io/`：`SceneSerializer`、协议 DSL、`policies/`（统一的可选/可序列化规则）；
  - 其他支持模块：`animation/`、`types.ts`、`utils.ts`。
- `packages/extensions`：扩展能力 `@3d-editor/extensions`，划分为插件与工具：
  - `plugins/`：紧贴 `EnginePlugin` 生命周期的模块（吸附、性能、时间轴 + 自动驱动播放器）；
  - `kit/`：提供物理、地图、绘制、粒子、文本、后处理、材质等数据/工具接口，供业务层配合第三方库使用。
- `apps/demo-vue3`：Vue3 演示应用（通用编辑器 + 工厂场景）。
- `docs`：内核演进笔记与问题记录。

## 运行与开发命令
- 安装依赖：`pnpm install`（要求 Node >=18、pnpm >=8）。
- 开发模式：`pnpm dev`，由 turbo 统一调度各 workspace。
- 构建：`pnpm build`。
- 测试：`pnpm test`（工作区 Vitest）。
- 代码质量：`pnpm lint`。
- 文档站（若需）：`pnpm docs:dev` / `pnpm docs:build`。

## 内核使用简述
1. 创建 `CoreContext`，通过 `controls.factory` 可替换控制器，`plugins` 注入扩展。
2. 使用 `ctx.actions` 提供的增删/成组/对齐等操作，自动同步历史与事件，避免业务重复写命令。
3. 通过 `scene`、`selection`、`transform`、`history`、`serializer` 等子系统构建 UI，`SceneSerializer` 支持 scene、lights、camera、metadata 的读写。
4. 组合 `@3d-editor/extensions/plugins` 中的吸附、性能、时间轴插件，并可借助 `TimelinePlayer` 驱动对象属性。
5. 若需更底层的数据（材质配置、物理体、路径、粒子等），可通过 `@3d-editor/extensions/kit` 的工具类，并结合三方渲染或物理库实现。

## 文档入口（中文说明优先）
- 引擎使用指南：`packages/engine/docs/USAGE.md`（含目录映射、核心 API、插件/动作层说明）。
- 场景协议速览：`packages/engine/docs/SCHEMA.md`。
- 扩展能力说明：`packages/extensions/docs/USAGE.md`（说明插件与 kit 的定位、timeline 自动应用等）。
