# 3D Editor Monorepo Packages Architecture

本文档基于当前仓库实现与近期讨论结论，说明 `packages` 下各包的职责边界、Preset 抽象的目标与落地方式、与 Extensions 的关系、以及典型应用场景。

## 背景与目标

当前应用层（例如 `apps/demo-vue3/src/views/factory/composables/useEditor.ts`）在“场景搭建/视觉调参”上承担了大量 Three 细节：灯光、地面、环境、renderer toneMapping、材质 wrap/repeat 等。这会导致：

- 应用层代码冗长，且必须理解 Three 低层细节。
- `engine` 看起来像“薄封装”，价值集中在编辑交互而非场景装配。

**目标**：将“场景搭建的共性 + 风格/约定”抽象为 Presets，使应用层只需选择/配置 Preset 即可得到可编辑场景；应用层只保留差异化业务逻辑。

## 包职责

### `packages/engine`（Core / Runtime）

定位：**通用编辑器内核 + Preset 机制**。  
不承载具体业务场景风格（如工厂/园区/机房），只提供装配能力与编辑器运行期能力。

核心职责：

- **Runtime Core**
  - `CoreContext`：创建 Three 场景、renderer、camera、render loop。
  - 统一生命周期：init / dispose / resize / render hooks。
- **Editing Capabilities**
  - 选择、变换、轨道控制、对齐、辅助线、选中高亮。
  - 历史（undo/redo）、命令/动作（add/remove/group/align）。
  - 序列化/反序列化（SceneSerializer）。
- **Plugin System**
  - `PluginManager`、事件总线 `EventBus`。
  - 允许扩展工具、交互模式、渲染前后钩子。
- **Preset System（新增抽象）**
  - `ScenePreset` 接口：描述“场景/编辑器装配意图”。
  - `PresetManager`：注册、应用、切换 Preset，负责旧 Preset 清理。
  - `CoreContext.applyPreset(...)`：对外的一键装配入口。
- **Conventions / Defaults（可选）**
  - 把跨应用的默认约定下沉为 base preset 或默认策略：
    - renderer：toneMapping / exposure / color space / shadowMap。
    - camera/orbit 初始位置/目标点。
    - scene：背景色/雾/网格/地面开关。

不做的事：

- 不提供具体业务场景（比如“工厂地面 + 工业光方案”）。
- 不在 core 内写死贴图、HDRI、资产路径。

### `packages/extensions`（Tools / Plugins）

定位：**运行期交互与编辑增强插件库**。

核心职责：

- 提供可插拔工具与系统：
  - snap/吸附、测量、特殊 gizmo、交互模式、选择规则增强等。
- 以插件形式接入 `engine`：
  - 通过 `PluginManager.register(...)` 与 `EventBus` 参与编辑流程。

特点：

- 原子化、无业务场景语义。
- 只关注“能力”，不关注“装配风格”。

### `packages/presets`（Scene / Editor Presets，计划新增）

定位：**场景装配方案库**，提供“一键初始化”的场景/编辑器默认组合。

核心职责：

- 实现多个 `ScenePreset`：
  - `factoryPreset` / `campusPreset` / `datacenterPreset` 等。
- 在 preset 内部组合：
  - renderer & 环境约定（必要时覆写 base defaults）。
  - 场景元素（地面/天空盒/HDRI/灯光/默认后处理）。
  - 需要的 extensions（可选）：如 snap、measurement、outline 等。
- 对外暴露**声明式参数**：
  - 应用层只传入意图配置（尺寸、风格、资源 URL），不再操作 Three 细节。

依赖关系：

- `presets` 可以依赖 `engine` 与 `extensions`。
- `extensions` 不依赖 `presets`（避免反向耦合）。

## 架构设计

### 分层关系图（逻辑架构）

```
┌──────────────────────────────────────────────────────────┐
│                          Apps                            │
│  demo-vue3 / factory-editor / other domain editors       │
│  - 选择 preset + 传参                                   │
│  - 编写差异化业务逻辑（spawn/规则/数据绑定）             │
└───────────────▲──────────────────────────▲───────────────┘
                │                          │
                │ applyPreset()            │ runtime usage
                │                          │ (actions/selection/...)
┌───────────────┴──────────────┐  ┌────────┴────────────────┐
│        packages/presets       │  │     packages/extensions │
│  Scene/Editor Presets         │  │  Plugins & Tools        │
│  - factory/campus/...         │  │  - snap/measure/...     │
│  - 组合场景与默认工具         │  │  - 原子编辑能力         │
└───────────────▲──────────────┘  └────────▲────────────────┘
                │                            │
                │ implements ScenePreset      │ registers plugins
                │                            │
┌───────────────┴────────────────────────────┴──────────────┐
│                     packages/engine (Core)                 │
│  - CoreContext (Scene/Renderer/Camera/Loop)                │
│  - Editing subsystems (actions/history/selection/...)      │
│  - PluginManager + EventBus                                │
│  - PresetManager + ScenePreset interface (新增)            │
└──────────────────────────────────────────────────────────┘
```

### 运行时装配流程（序列图）

```
App                    CoreContext              PresetManager          ScenePreset           Extensions
 |  new CoreContext()        |                        |                     |                   |
 |-------------------------->|                        |                     |                   |
 |  applyPreset(id, opts)    |                        |                     |                   |
 |-------------------------->|  apply(...)            |                     |                   |
 |                           |----------------------->|  dispose active     |                   |
 |                           |                        |-------------------->| dispose?          |
 |                           |                        |  setup new          |                   |
 |                           |                        |-------------------->| setup(ctx, opts)  |
 |                           |                        |                     |--register plugin->|
 |                           |                        |                     |  build scene       |
 |                           |<-----------------------| done                |                   |
 |  use ctx.actions/...      |                        |                     |                   |
```

## 应用层使用方式（约定）

应用层以“Preset 初始化 + Engine 运行期能力”两段式工作：

1. **装配场景（Preset）**

```ts
import { CoreContext } from '@3d-editor/engine'
import { factoryPreset } from '@3d-editor/presets'

const ctx = new CoreContext({ container, plugins: [] })
await ctx.applyPreset(factoryPreset, {
  floor: { width: 120, depth: 60, gltfUrl: '...' },
  lighting: { scheme: 'industrial-bright' },
  environment: { background: '#0c1626' }
})
```

2. **业务差异化（Engine 运行期能力）**

```ts
// 仍然使用 engine 的编辑能力
ctx.actions.addObject(mesh)
ctx.selection.select(mesh)
ctx.transform.setMode('translate')
ctx.history.undo()
const schema = ctx.serializeScene({ customData: {...} })
```

应用层不再手写：

- renderer 参数与色彩空间细节。
- 灯光/地面/环境/后处理的 Three 构造与调参。
- 贴图 wrap/repeat、roughness/metalness 等重复性规范。

## Preset 设计原则

- **声明式参数**：暴露“意图级配置”，不暴露 Three 细节。
  - 例：`lighting.scheme = 'industrial-bright'` 而不是传一堆光源强度/阴影参数。
- **可组合**：Preset 内可按需启用 extensions。
- **可替换**：切换 preset 应能清理旧场景元素。
- **约定优先**：提供合理默认值，应用层只覆写差异。
- **无业务耦合**：Preset 可有“风格语义”，但不包含应用数据/规则。

## 典型应用场景

### 工厂/产线编辑器（Factory Editor）

特征：

- 大面积地面（可配置尺寸、网格、标尺）。
- 工业光照方案（高亮、清晰阴影、冷色环境）。
- 资产库拖放、设备布置、管线连线、吸附对齐。

落地：

- `factoryPreset` 提供地面 + 工业灯光 + 环境/相机约定。
- `snap/align` 等工具由 preset 内启用。
- 应用层只做：设备 registry、spawn 逻辑、业务规则（如线到最近设备）。

### 园区/楼宇规划（Campus / Building）

特征：

- 大尺度户外环境、天空盒/HDRI。
- 多层/分区地面与地形。
- 资产分层管理、批量对齐、测量工具。

落地：

- `campusPreset` 提供天空盒/雾/日照方案/后处理。
- preset 启用测量与吸附插件。
- 应用层做 BIM/业务数据绑定与约束。

### 机房/仓储/机柜布局（Datacenter / Warehouse）

特征：

- 室内 PBR 环境、强规则化摆放。
- 预设灯光与反射环境。
- 栅格化布局、快速复制、吸附。

落地：

- `datacenterPreset` 提供室内灯光/反射/HDRI 与地面栅格。
- preset 启用栅格吸附插件。
- 应用层实现机柜/货架的业务模型与约束。

## 下一步落地建议

1. 在 `engine` 中实现 Preset 机制（接口 + manager + applyPreset）。
2. 新增 `packages/presets`，把现有 `factory` 场景搭建迁入 `factoryPreset`。
3. 将跨场景共性的 renderer/camera/scene defaults 下沉为 base preset 或 core conventions。
4. 调整 demo 应用初始化代码，验证应用层显著“瘦身”。

