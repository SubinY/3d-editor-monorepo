# 3D Editor Monorepo — 架构设计

本文描述当前仓库的分层职责、依赖关系、核心抽象与运行时装配方式。实现以源码为准；细节以 `packages/*/src` 为准。

## 1. 目标与边界

**目标**：提供可复用的 Three.js 3D 编辑器底座，让业务应用（工厂、园区、孪生等）通过「选 Preset + 写差异逻辑」快速落地，而不是在应用层堆叠灯光/地面/toneMapping 等装配细节。

**非目标**：

- engine 不承载具体业务场景风格（工厂贴图、机房栅格规则等）
- extensions 不描述场景风格，只提供原子能力
- apps 不反向污染 packages（不把 demo 业务规则塞进 engine）

## 2. 仓库形态

pnpm workspaces + Turborepo 的 TypeScript monorepo。

| 包 / 应用 | 名称 | 职责 |
|-----------|------|------|
| `packages/engine` | `@3d-editor/engine` | 编辑器内核：运行时、编辑子系统、Preset 机制、序列化 |
| `packages/extensions` | `@3d-editor/extensions` | 插件与工具包：吸附、时间轴、性能；kit 数据/工具接口 |
| `packages/presets` | `@3d-editor/presets` | 场景 / 编辑器装配方案（basic、factory 等） |
| `apps/demo-vue3` | demo-vue3 | 主演示：工厂编辑器 + 通用编辑器 |
| `apps/demo-view` | demo-view | 另一套视图向演示 |

依赖方向（单向、禁止反向）：

```
apps ──► presets ──► extensions ──► engine
              └──► engine
```

## 3. 逻辑分层

```
┌─────────────────────────────────────────────────────────┐
│  Apps（demo-vue3 / demo-view）                           │
│  - 选 Preset / Runtime、传声明式参数                      │
│  - UI、路由、业务 registry / spawn / 规则                 │
└───────────────▲──────────────────────────▲──────────────┘
                │ applyPreset / runtime    │ actions/selection/...
┌───────────────┴──────────────┐  ┌────────┴────────────────┐
│  packages/presets            │  │  packages/extensions    │
│  ScenePreset + Editor Runtime│  │  plugins + kit          │
└───────────────▲──────────────┘  └────────▲────────────────┘
                │ implements / uses         │ register plugins
┌───────────────┴───────────────────────────┴───────────────┐
│  packages/engine                                           │
│  CoreContext · PluginManager · PresetManager · Editing …  │
└───────────────────────────────────────────────────────────┘
```

### 3.1 engine — 内核

入口：`packages/engine/src/index.ts`。枢纽类：`CoreContext`。

| 子系统 | 路径 | 作用 |
|--------|------|------|
| Runtime | `runtime/` | `CoreContext`、Renderer、RenderLoop、Camera、EventBus、PluginManager、PresetManager、EditorActions |
| Editing | `editing/` | Orbit/Transform、Selection、History、SceneGraph、Alignment、Helpers、Highlight |
| Assets | `assets/` | Geometry / Material / Lighting 工厂、AssetLoader、AssetRegistry |
| IO | `io/` + `dsl/` | SceneSerializer、扩展 SceneSchema |
| Policies | `policies/` | 可选中 / 可序列化规则（`EditorObjectPolicy`） |
| Animation | `animation/` | 动画系统 |

**Preset 机制（内核抽象，不含具体风格）**：

- `ScenePreset<TOptions, TState>`：`id` + `setup(ctx, options)` + 可选 `dispose`
- `PresetManager`：注册、`apply`（先 dispose 旧实例再 setup）、跟踪 active
- `CoreContext.applyPreset(...)`：对外一键装配入口

**插件机制**：

- `EnginePlugin` 挂接渲染前后、选中、变换、序列化等钩子
- 具体插件实现落在 `extensions`，由应用或 preset/runtime 注册

### 3.2 extensions — 能力扩展

| 类别 | 路径 | 说明 |
|------|------|------|
| plugins | `plugins/snap`、`timeline`、`performance` | 实现 `EnginePlugin`，可注入 CoreContext |
| kit | `kit/*`（drawing、map、material、particle、physics、text、vfx） | 数据/工具接口，供业务配合第三方库使用；无场景风格语义 |

原则：原子、无业务场景语义；`extensions` 不依赖 `presets`。

### 3.3 presets — 场景装配

定位：把「场景共性 + 风格约定」做成可切换方案，应用层只传意图级参数。

当前实现：

| Preset | 说明 |
|--------|------|
| `basicPreset` | 通用灯光 / 背景 / 可选网格与 HDRI 环境 |
| `factoryPreset` + `createFactoryRuntime` | 工厂编辑器：装配层（renderer/camera/floor/lighting/background）+ 运行时（spawn、工具、吸附、管线等） |

推荐目录约定（以 factory 为范本）：

```
presets/<name>/
  preset/     # 静态装配（ScenePreset.setup / dispose）
  runtime/    # 编辑器运行时门面（对 apps 友好的 API）
  index.ts
```

设计原则：

- 声明式参数（如 lighting scheme），不暴露大量 Three 调参
- 可替换：切换 preset 必须能清理旧状态
- 可组合：preset / runtime 内按需启用 extensions
- 无应用数据耦合：不含业务 registry 规则（那一层放 runtime 或 app）

## 4. 运行时装配流程

```
App                     CoreContext           PresetManager         ScenePreset
 |  new CoreContext()        |                      |                    |
 |-------------------------->|                      |                    |
 |  applyPreset(p, opts)     |                      |                    |
 |-------------------------->|  apply(...)          |                    |
 |                           |--------------------->| dispose active     |
 |                           |                      |------------------->|
 |                           |                      | setup(ctx, opts)   |
 |                           |                      |------------------->|
 |                           |<---------------------| done               |
 |  ctx.actions / selection… |                      |                    |
```

工厂演示实际路径（`demo-vue3`）：

1. `createEditor()` → `createFactoryRuntime()`
2. `runtime.init(container)` 内部创建 `CoreContext` 并应用 `factoryPreset`
3. UI 调用 `spawn` / `setTool` / `undo` 等 runtime API
4. 底层落到 `ctx.actions`、`selection`、`history`、`serializer`

## 5. 场景协议与持久化

- 基础类型：`packages/engine/src/types.ts`（`SceneSchema`、对象 / 灯光 / metadata 等）
- 序列化：`SceneSerializer`，经 `EditorObjectPolicy` 过滤不可序列化对象
- 扩展：`dsl/schema.ts` 的 `ExtendedSceneSchema`（controls、postProcessing、animations、physics、customData）
- 插件可在序列化 / 反序列化钩子中补字段

## 6. 应用层约定

两段式：

1. **装配**：`applyPreset` 或 `createXxxRuntime().init(container)`
2. **差异逻辑**：业务 spawn、约束、UI 绑定；编辑操作优先走 `ctx.actions`，以获得历史与事件一致性

应用层应避免长期手写：renderer 色彩空间、重复灯光地面构造、贴图 wrap/repeat 等可下沉规范。

## 7. 演进方向（与现状对齐）

已落地：`PresetManager` / `ScenePreset`、`packages/presets`（basic + factory）、demo 经 factory runtime 瘦身。

可继续：更多场景 preset（campus / datacenter）、跨场景 base conventions、补齐 Vitest 覆盖、保持 `AGENTS.md` 与本文同步。
