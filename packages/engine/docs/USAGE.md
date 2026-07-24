# @3d-editor/engine 使用指南

`@3d-editor/engine` 是封装在 Three.js 之上的 3D 编辑器内核，提供场景/渲染、选中/变换、历史、序列化与插件层，便于多业务快速搭建可组合的编辑器体验。

## 目录映射
- `runtime/`：`CoreContext`、渲染循环、相机、事件总线、插件管理、`EditorActions` 等运行时入口。
- `editing/`：控制器（Orbit/Transform）、射线选中、历史记录、场景树、对齐工具、辅助/高亮等编辑能力。
- `assets/`：几何/材质/光照工厂、`AssetLoader`、`AssetRegistry`。
- `io/`：`SceneSerializer`、DSL 拓展、`policies/`（统一判断可选中与可序列化）。
- 其他：`animation/`、`types.ts`、`utils.ts` 支持模块。

## 核心入口：CoreContext

```ts
const ctx = new CoreContext({
  container,
  rendererOptions: { antialias: true },
  plugins: [createSnapPlugin({ gridSize: 1 })]
})
```

`CoreContext` 统一暴露：
1. 渲染/相机：`renderer`、`renderLoop`、`cameraManager`、`controls`。
2. 编辑系统：`scene`、`selection`、`transform`、`sceneGraph`、`alignment`。
3. 状态与事件：`history`、`animation`、`eventBus`、`pluginManager`。
4. 资源、序列化与动作：`serializer`、`actions`。

`serializeScene`/`loadScene` 可读写 `SceneSchema`，支持自定义 `controls`、`renderer`、`postProcessing`、`animations`、`physics` 等扩展字段。

## 插件系统：EnginePlugin

插件定义在 `runtime/PluginManager.ts`，可订阅 `onBeforeRender`、`onAfterRender`、`onSelectionChanged`、`onTransform`、`onSceneSerialized`、`onSceneDeserialized` 等生命周期：

- `register(plugin)`、`registerMany(...)`、`emit*`、`disposeAll()`。
- 典型插件见 `packages/extensions/src/plugins`（吸附、性能、时间轴 + 自动播放器）。

## 官方动作层：EditorActions

`CoreContext.actions` 将常见操作封装为命令，并自动同步 `HistoryManager` 与 `EventBus`：

- `addObject(obj, { parent?, select? })`
- `removeObject(obj, { deselect? })`
- `group(selection)` / `ungroup(group)`
- `align(objects, type)`：调用 `AlignmentTool` 并记录前后变换。

上层调用这些方法即可获得撤销/重做和事件通知，无需重复写 command。

## 选中与变换

`selection/SelectionManager` 通过 `EditorObjectPolicy` 统一判断哪些对象可选（过滤辅助对象、`userData.nonSelectable`、高亮、TransformControls 等），并通过 `eventBus` 触发 `OBJECT_SELECTED`。

`transform/TransformController` 支持 `attach`、`attachMultiple`、`setMode`、`isMultiSelection`，并自动在拖拽结束时通过 `HistoryManager.recordTransform` 记录快照。

## 场景协议与序列化

- 所有类型定义在 `types.ts`（`SceneSchema`、`ObjectSchema`、`LightSchema`、`SceneMetadata` 等）。  
- `SceneSerializer` 只序列化 `EditorObjectPolicy.isSerializable` 的 Mesh/Group，灯光单独枚举。  
- `io/dsl/schema.ts` 提供扩展协议 `ExtendedSceneSchema`，插件可在 `onSceneSerialized`/`onSceneDeserialized` 中补字段。

## 辅助工厂与资源

- 几何：`GeometryFactory`、`createBox`/`createPlane`/`createSphere`。  
- 材质：`MaterialFactory` 零配置创建 `MeshStandardMaterial`/`MeshBasicMaterial`。  
- 光照：`LightingFactory` 封装 Ambient/Directional。  
- 资源：`AssetLoader.loadGLTF` + `AssetRegistry` 管理资源元数据。  

## 事件与历史

- `runtime/EventBus.ts` 提供 `on`/`off`/`emit`，常见事件见 `EditorEvents`（选中、变换、添加、移除、场景更新）。
- `editing/history/HistoryManager.ts` 支持命令执行、事务、快照、undo/redo、`recordTransform` 等。

结合上述模块，即可在不直接操作 Three.js 的前提下，完成「增删改查 + 选中 + 变换 + 撤销重做 + 场景持久化」。
