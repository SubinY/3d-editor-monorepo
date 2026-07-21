# @3d-editor/extensions 能力文档

`@3d-editor/extensions` 在 `@3d-editor/engine` 之上提供可复用的能力模块，按职责分为：

- `plugins/`（插件型）：直接接入 `EnginePlugin` 生命周期，可以在渲染循环中执行逻辑；包含吸附（Snap）、性能监控（Performance）、时间轴（Timeline + `TimelinePlayer`）。
- `kit/`（工具型）：提供物理、地图、路径、粒子、文本、后处理、材质等数据与助手，供业务层没必要依赖 `EnginePlugin` 也能复用。

## 插件型能力（`plugins/`）

1. `createSnapPlugin(options)`：在 `onTransform` 中自动对当前对象的位置与旋转进行格点/角度吸附，`options` 支持 `gridSize`、`angleStep`、`enabled`。
2. `createPerformancePlugin({ onUpdate, name })`：每帧统计 FPS、drawCalls、triangles，向 `onUpdate` 反馈性能数据。
3. `createTimelinePlugin({ timeline?, autoPlay?, onTick?, autoApply? })`：在 `onBeforeRender` 推进时间轴，默认通过 `TimelinePlayer` 把轨道数据写回对象属性（number/vector3/color/quaternion 的线性插值），`autoApply` 设为 `false` 时仅保留 `onTick` 回调。

## 工具型能力（`kit/`）

- `DrawingManager`：管理 `DrawPath` 数据，可在业务层将路径转换为线、管线、布置脚本。
- `PhysicsWorld`：持有 `PhysicsBodySchema`，为接入 Cannon/Ammo/Rapier 提供统一数据。
- `MapLayer`：封装 GeoJSON Feature，便于业务扩展地图渲染。
- `TextFactory`：占位式文本配置，结合 Three.js TextGeometry 或 troika-3d-text 实现。
- `ParticleEmitter`：保存粒子发射参数，需与自研/第三方粒子系统对接。
- `EffectPipeline`：收集 Bloom/SSAO/FXAA 等后处理配置，配合 postprocessing 等库消费。
- `MaterialEditor`：帮助统一给选择对象应用 `MeshStandardMaterial`，可异步加载贴图。
- `PerformanceMonitor`、`SnapSystem` 等工具也同时暴露在 `kit/` 中供不使用插件机制的场景复用。

## 组织建议

1. 当功能需要与渲染/交互生命周期紧密结合（如吸附、性能监控、时间轴数据驱动）时，从 `@3d-editor/extensions/plugins` 导入并传入 `CoreContext` 的 `plugins` 数组。
2. 当场景仅需一组数据结构或配置（如物理体、路径、材质），直接从 `@3d-editor/extensions/kit` 中导入对应类，在业务层负责和三方库的集成。
3. Timeline 相关推荐统一使用插件 + `TimelinePlayer` 的组合，以便在渲染循环中自动驱动对象，而不是在业务中重复推进时间。

## 额外说明

- 所有模块均使用 TypeScript 类型定义（可在 `packages/extensions/src/kit` 与 `plugins` 中查阅）。  
- `kit/` 中部分类为 placeholder，需结合具体渲染/粒子/物理库补全实际效果。  
- 扩展文档可参照 `apps/demo-vue3` 中的使用方式：编辑器示例同时使用了 `createSnapPlugin`、`createPerformancePlugin` 与 `MaterialEditor`、`DrawingManager` 等工具。
