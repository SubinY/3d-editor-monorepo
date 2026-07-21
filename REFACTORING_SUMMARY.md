# Preset 机制重构总结

## 重构目标

1. ✅ 完善 Preset 机制并调整应用层代码
2. ✅ 保证现有场景编辑器内容不变
3. ✅ 设计清晰的 preset 目录结构
4. ✅ 优化 CoreContext 使用方式

## 完成的工作

### 1. Engine 层面（已有基础，已优化）

**位置**: `packages/engine/src/runtime/`

- ✅ `PresetManager.ts` - Preset 管理器（已存在，修复类型问题）
- ✅ `CoreContext.ts` - 已有 `applyPreset()` 方法
- ✅ 类型安全修复

### 2. Preset 目录结构设计

**新结构**: `packages/presets/src/presets/factory/`

```
factory/
├── index.ts              # 对外暴露的主入口
├── factory-preset.ts     # Preset 主文件
├── types.ts              # 类型定义
├── renderer.ts           # 渲染器配置
├── background.ts         # 背景渐变
├── camera.ts             # 相机配置
├── lighting.ts           # 灯光系统
└── floor.ts              # 地板系统（反射、边框、标注）
```

**设计原则**：
- **单一职责**：每个模块负责一个功能领域
- **可组合**：各模块可独立使用或组合
- **声明式 API**：暴露意图级配置，隐藏 Three.js 细节
- **清晰入口**：`index.ts` 作为唯一对外接口

### 3. 应用层代码简化

**文件**: `apps/demo-vue3/src/views/factory/composables/useEditor.ts`

**重构前**: 577 行（包含大量场景搭建代码）
**重构后**: 280 行（减少 51%）

**移除的代码**：
- ❌ `configureRenderer()` - 72-85 行
- ❌ `applyGradientBackground()` - 87-95 行
- ❌ `getNoiseTexture()` - 97-116 行
- ❌ `configureCamera()` - 118-125 行
- ❌ `setupLights()` - 127-155 行
- ❌ `updateLightShadowBounds()` - 157-167 行
- ❌ `updateReflectiveFloor()` - 169-280 行
- ❌ `ensureFloorGroup()` - 228-240 行
- ❌ `clearGroup()` - 242-248 行
- ❌ `disposeObject()` - 250-263 行
- ❌ `disposeMaterial()` - 265-271 行

**新的初始化方式**：

```typescript
// 重构前（400+ 行场景搭建代码）
const init = async (container: HTMLElement) => {
  ctx.value = new CoreContext({ ... })
  configureRenderer(container)
  configureCamera()
  setupLights()
  updateReflectiveFloor()
  // ... 更多配置
}

// 重构后（一键装配）
const init = async (container: HTMLElement) => {
  ctx.value = new CoreContext({ ... })
  
  const applied = await ctx.value.applyPreset(factoryPreset, {
    floor: { width: 140, depth: 50 },
    lighting: { ambientIntensity: 0.4 },
    camera: { position: [0, 60, 100] },
    background: { enableNoise: true }
  })
  
  presetState.value = applied.state
  // 只保留业务逻辑
}
```

### 4. 功能验证

✅ **测试结果**：
- 场景正常渲染（地板、灯光、相机）
- 机器人模型正常加载
- 变换控制器正常工作
- 地板调整功能正常（X+ 按钮测试通过：140m → 150m）
- 构建成功（`pnpm build` 通过）

## 架构优势

### Before（重构前）

```
应用层 useEditor.ts (577 行)
├── 场景搭建代码 (400+ 行) ❌ 重复、臃肿
│   ├── 渲染器配置
│   ├── 灯光设置
│   ├── 地板创建
│   └── 相机配置
└── 业务逻辑 (150 行)
    ├── spawn
    ├── select
    └── 事件处理
```

### After（重构后）

```
应用层 useEditor.ts (280 行)
├── Preset 装配 (10 行) ✅ 简洁
│   └── ctx.applyPreset(factoryPreset, options)
└── 业务逻辑 (270 行) ✅ 专注
    ├── spawn
    ├── select
    └── 事件处理

Preset 层 factory/ (模块化)
├── factory-preset.ts (主入口)
├── renderer.ts (渲染器)
├── lighting.ts (灯光)
├── floor.ts (地板)
├── camera.ts (相机)
└── background.ts (背景)
```

## 关键改进

### 1. 代码复用性

**重构前**：每个场景都要重写一遍场景搭建代码
**重构后**：
```typescript
// 工厂场景
await ctx.applyPreset(factoryPreset, { ... })

// 园区场景（未来）
await ctx.applyPreset(campusPreset, { ... })

// 机房场景（未来）
await ctx.applyPreset(datacenterPreset, { ... })
```

### 2. 可维护性

**模块化**：每个功能独立文件，易于定位和修改
**类型安全**：完整的 TypeScript 类型定义
**清晰职责**：应用层只关注业务，Preset 层负责场景

### 3. 扩展性

**新增 Preset 只需**：
1. 创建 `packages/presets/src/presets/xxx/` 目录
2. 实现 `ScenePreset` 接口
3. 导出到 `packages/presets/src/index.ts`

**应用层无需修改**：
```typescript
// 切换场景只需改一行
await ctx.applyPreset(newPreset, options)
```

## 关于第三点讨论：ctx 的使用方式

### 当前方式（Ref 包装）

```typescript
const ctx = ref<CoreContext | null>(null)
const presetState = ref<FactoryPresetState | null>(null)

// 使用时需要 .value
ctx.value?.applyPreset(...)
presetState.value?.clampToFloor(obj)
```

**优点**：
- ✅ Vue 响应式，自动追踪依赖
- ✅ 组件卸载时易于清理
- ✅ 符合 Vue 3 Composition API 习惯

**缺点**：
- ❌ 每次访问都要 `.value`
- ❌ 需要空值检查 `?.`

### 替代方案（直接实例）

```typescript
let ctx: CoreContext | null = null
let presetState: FactoryPresetState | null = null

// 使用时更简洁
ctx?.applyPreset(...)
presetState?.clampToFloor(obj)
```

**优点**：
- ✅ 代码更简洁
- ✅ 不需要 `.value`

**缺点**：
- ❌ 失去 Vue 响应式
- ❌ 需要手动触发更新

### 推荐方案（混合）

```typescript
// 核心实例不需要响应式
let ctx: CoreContext | null = null
let presetState: FactoryPresetState | null = null

// 需要响应式的状态单独提取
const floorSize = reactive({ width: 140, depth: 50 })
const isReady = ref(false)
```

**理由**：
- CoreContext 本身是命令式 API，不需要响应式
- 只对需要驱动 UI 的状态使用响应式
- 减少不必要的响应式开销

## 总结

✅ **所有目标达成**：
1. Preset 机制完善且可用
2. 现有功能完全保留
3. 代码量减少 51%
4. 架构清晰可扩展

🎯 **下一步建议**：
1. 创建 `campusPreset`、`datacenterPreset` 等其他场景
2. 考虑将 `ctx` 改为非响应式实例（性能优化）
3. 补充单元测试
4. 完善文档和示例

