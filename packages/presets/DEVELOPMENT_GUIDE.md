# Presets 开发规范

本文档定义了开发新 preset（场景编辑器）的最小规范和最佳实践。这些规范不是强制约束，而是为了确保不同 preset 之间的一致性、可维护性和可复用性。

## 目录结构

每个 preset 应遵循以下目录结构：

```
presets/
  <preset-name>/
    preset/              # 场景装配层（Scene Setup）
      <preset-name>-preset.ts    # 主 preset 定义
      types.ts                    # Options 和 State 类型定义
      background.ts               # 背景配置（可选）
      camera.ts                   # 相机配置（可选）
      lighting.ts                 # 灯光配置（可选）
      floor.ts                    # 地板/地面配置（可选）
      renderer.ts                 # 渲染器配置（可选）
      index.ts                    # 装配层导出
    runtime/              # 编辑器运行时层（Editor Runtime）
      runtime.ts                  # Runtime 实现
      index.ts                    # 运行时层导出
    index.ts              # 统一导出入口
    README.md             # 该 preset 的使用文档（可选）
```

### 目录职责说明

- **preset/**：负责场景的**静态装配**（灯光、相机、地板、背景、渲染器配置等）
- **runtime/**：负责编辑器的**运行时交互**（创建、选择、撤销重做、工具切换、序列化等）
- **index.ts**：统一导出，应用层通过 `import { xxxPreset, createXxxRuntime } from '@3d-editor/presets'` 使用

## Preset 层规范

### 1. Preset 定义

每个 preset 必须实现 `ScenePreset<TOptions, TState>` 接口：

```typescript
import type { CoreContext, ScenePreset } from '@3d-editor/engine'

export const myPreset: ScenePreset<MyPresetOptions, MyPresetState> = {
  id: 'my-preset',
  label: 'My Editor Preset',
  
  async setup(ctx: CoreContext, options?: MyPresetOptions): Promise<MyPresetState> {
    // 1. 配置渲染器（如果需要）
    configureRenderer(ctx, options?.renderer)
    
    // 2. 应用背景（如果需要）
    const container = ctx.renderer.domElement.parentElement
    if (container) {
      applyBackground(container, options?.background)
    }
    
    // 3. 配置相机
    configureCamera(ctx, options?.camera)
    
    // 4. 设置场景元素（地板、灯光等）
    const floorState = setupFloor(ctx, options?.floor)
    const lightingState = setupLights(ctx, options?.lighting)
    
    // 5. 返回状态对象
    return {
      container: container!,
      ...floorState,
      ...lightingState
    }
  },
  
  dispose(ctx: CoreContext, state?: MyPresetState) {
    // 清理资源：移除场景对象、恢复背景等
    if (!state) return
    // ... 清理逻辑
  }
}
```

### 2. Options 和 State 类型

**Options**：用户可配置的参数，所有字段应为可选：

```typescript
export interface MyPresetOptions {
  background?: {
    gradient?: string[]
    enableNoise?: boolean
  }
  floor?: {
    width?: number
    depth?: number
    color?: number | string
  }
  lighting?: {
    ambientColor?: number | string
    ambientIntensity?: number
    mainIntensity?: number
  }
  camera?: {
    fov?: number
    position?: [number, number, number]
    target?: [number, number, number]
  }
  renderer?: {
    toneMapping?: THREE.ToneMapping
    shadowMapType?: THREE.ShadowMapType
  }
}
```

**State**：preset 返回的状态对象，包含运行时需要的方法和引用：

```typescript
export interface MyPresetState {
  container: HTMLElement
  floorSize: { width: number; depth: number }
  lights: THREE.Light[]
  // 运行时方法
  resizeFloor?: (options?: { deltaX?: number; deltaZ?: number }) => Promise<{ width: number; depth: number }>
  clampToFloor?: (obj: THREE.Object3D) => void
  updateLightShadowBounds?: () => void
}
```

### 3. 配置函数

将场景装配拆分为独立的配置函数，便于测试和复用：

- `configureRenderer(ctx, options?)`：配置渲染器（阴影、色调映射等）
- `configureCamera(ctx, options?)`：配置相机（FOV、位置、目标）
- `setupLights(ctx, options?)`：设置灯光（环境光、主光源、阴影）
- `setupFloor(ctx, options?)`：设置地板/地面（尺寸、材质、边框）
- `applyBackground(container, options?)`：应用背景（渐变、纹理等）

每个函数应：
- 接受 `CoreContext` 和对应的 options
- 设置合理的默认值
- 返回必要的状态或 void

## Runtime 层规范

### 1. Runtime 接口

每个 runtime 应提供统一的接口：

```typescript
export interface MyRuntime {
  // 生命周期
  getContext: () => CoreContext | null
  init: (container: HTMLElement) => Promise<void>
  dispose: () => void
  
  // 编辑操作
  spawn: (id: string, position?: THREE.Vector3) => void
  select: (obj: THREE.Object3D | null) => void
  removeSelection: () => void
  getSelection: () => THREE.Object3D[]
  
  // 工具切换
  setTool: (mode: 'translate' | 'rotate' | 'scale') => void
  
  // 历史操作
  undo: () => void
  redo: () => void
  reset: () => void
  
  // 序列化
  save: () => any
  
  // 场景特定操作（如地板调整）
  resizeFloor?: (deltaX: number, deltaZ: number) => Promise<void>
  
  // 组件注册
  registerComponent?: (id: string, opts: ComponentOptions) => void
}
```

### 2. Runtime 创建函数

```typescript
export interface MyRuntimeOptions {
  initialFloorSize?: { width: number; depth: number }
  presetOptions?: MyPresetOptions
  snap?: { gridSize?: number; angleStep?: number }
  onFloorSizeChange?: (size: { width: number; depth: number }) => void
}

export function createMyRuntime(options?: MyRuntimeOptions): MyRuntime {
  let ctx: CoreContext | null = null
  let presetState: MyPresetState | null = null
  
  const init = async (container: HTMLElement) => {
    // 1. 创建 CoreContext
    ctx = new CoreContext({
      container,
      rendererOptions: { antialias: true, alpha: true },
      plugins: [/* 插件列表 */]
    })
    
    // 2. 应用 preset
    const applied = await ctx.applyPreset(myPreset, {
      // 合并默认值和用户选项
      ...options?.presetOptions
    })
    
    presetState = applied.state as MyPresetState
    
    // 3. 配置编辑器（TransformControls、事件监听等）
    // ...
  }
  
  // 实现其他方法...
  
  return {
    getContext: () => ctx,
    init,
    // ... 其他方法
  }
}
```

### 3. 关键实现要点

- **纯 TypeScript**：runtime 不应依赖 Vue/React 等框架
- **状态管理**：使用普通变量/对象，而非响应式系统
- **事件监听**：在 `init` 中绑定，在 `dispose` 中解绑
- **错误处理**：对关键操作进行空值检查
- **资源清理**：`dispose` 应彻底清理所有资源

## 导出规范

### preset/index.ts

```typescript
// Preset 装配层导出
export { myPreset } from './my-preset'
export type { MyPresetOptions, MyPresetState } from './types'

// 低层配置函数（供高级用户使用）
export { configureRenderer } from './renderer'
export { configureCamera } from './camera'
export { setupLights } from './lighting'
export { setupFloor } from './floor'
```

### runtime/index.ts

```typescript
// Runtime 运行时层导出
export { createMyRuntime } from './runtime'
export type { MyRuntime, MyRuntimeOptions, MyComponentOptions } from './runtime'
```

### 根 index.ts

```typescript
// Preset 装配层
export * from './preset'

// Runtime 运行时层
export * from './runtime'
```

## 应用层使用规范

### 1. 在 Vue 中使用（示例）

```typescript
// composables/useEditor.ts
import { createMyRuntime } from '@3d-editor/presets'
import { ref, reactive } from 'vue'

export function createEditor() {
  const ctx = ref<CoreContext | null>(null)
  const floorSize = reactive({ width: 140, depth: 50 })
  
  const runtime = createMyRuntime({
    initialFloorSize: { width: floorSize.width, depth: floorSize.depth },
    onFloorSizeChange: size => {
      floorSize.width = size.width
      floorSize.depth = size.depth
    }
  })
  
  const init = async (container: HTMLElement) => {
    await runtime.init(container)
    ctx.value = runtime.getContext()
  }
  
  return {
    ctx,
    floorSize,
    init,
    spawn: runtime.spawn,
    select: runtime.select,
    undo: runtime.undo,
    redo: runtime.redo,
    // ... 其他方法
  }
}
```

### 2. 模型注册

模型应在应用层注册，通过 `registerComponent` 注入：

```typescript
// 应用层定义模型工厂
const componentFactories: Record<string, () => THREE.Object3D> = {
  robot: () => createRobotModel(),
  machine: () => createMachineModel(),
}

// 注册到 runtime
componentFactories.forEach((factory, id) => {
  runtime.registerComponent(id, { createMesh: factory })
})
```

**注意**：preset 不应包含具体的模型路径或资源，这些应由应用层提供。

## 最佳实践

### 1. 默认值策略

- 所有 options 字段应为可选
- 提供合理的默认值（在配置函数中）
- 使用 `??` 或 `||` 设置默认值

### 2. 资源管理

- 在 `dispose` 中清理所有 Three.js 对象（geometry、material、texture）
- 移除事件监听器
- 清理 DOM 引用

### 3. 类型安全

- 使用明确的类型定义，避免 `any`
- 为所有公共 API 提供类型
- 使用 TypeScript 的严格模式

### 4. 可扩展性

- 通过 options 暴露可配置项
- 提供 hooks/回调函数供用户扩展
- 避免硬编码业务逻辑

### 5. 文档

- 为每个 preset 提供 README.md（可选但推荐）
- 说明预设的使用场景、参数含义、示例代码
- 标注特殊行为和限制

## 检查清单

开发新 preset 时，确保：

- [ ] 目录结构符合规范（preset/ 和 runtime/ 分离）
- [ ] Preset 实现了 `ScenePreset` 接口
- [ ] Options 和 State 类型定义完整
- [ ] Runtime 提供了标准接口（init/dispose/spawn/select/undo/redo/save）
- [ ] 所有导出在 index.ts 中统一管理
- [ ] 资源清理在 dispose 中完成
- [ ] 不包含应用层特定的资源路径
- [ ] 提供了合理的默认值
- [ ] 类型定义完整，无 `any` 滥用

## 参考实现

参考 `packages/presets/src/presets/factory/` 作为标准实现示例。

