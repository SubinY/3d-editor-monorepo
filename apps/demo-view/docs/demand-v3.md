# 需求文档 v3：场景级灯光配置（开发版）

**版本**：2.0  
**目标**：场景与资产编辑器获得明亮默认观感，可直接进入开发。

---

## 1. 需求摘要

- **背景**：纯色，默认明亮浅灰蓝 `#e8ecf0`
- **Environment**：使用本地 HDR 作为 `scene.environment`（IBL + 反射），背景保持纯色
- **灯光**：提高 ambient、directional 强度

---

## 2. 资源说明

**HDR 路径**：`apps/demo-view/src/assets/IndoorEnvironmentHDRI005_1K/`

| 文件 | 用途 |
|------|------|
| `IndoorEnvironmentHDRI005_1K_HDR.exr` | 默认 environment（IBL 用） |
| `IndoorEnvironmentHDRI005_1K_TONEMAPPED.jpg` | 备用 LDR |
| `IndoorEnvironmentHDRI005.png` | 备用 LDR |

**实际使用**：`IndoorEnvironmentHDRI005_1K_HDR.exr`  
加载方式：Three.js `EXRLoader` → `PMREMGenerator` → `scene.environment`。Vite 中可用 `?url` 引入或放入 `public` 后直接用 URL。

---

## 3. 默认配置

```typescript
const DEFAULT_SCENE_ENV = {
  background: '#e8ecf0',
  ambientIntensity: 0.9,
  dirIntensity: 1.5,
  dirPosition: [8, 15, 10] as [number, number, number],
  environment: {
    url: '/IndoorEnvironmentHDRI005_1K_HDR.exr',  // 或 import.meta.url 引入
    intensity: 1.0
  }
}
```

---

## 4. 开发任务清单

### 4.1 Preset 层（packages/presets）

| 任务 | 文件 | 说明 |
|------|------|------|
| 1 | `presets/basic.ts` | 支持 options.environment，用 EXRLoader 加载 HDR，PMREMGenerator 生成 envMap，赋值 `ctx.scene.environment` |
| 2 | `presets/basic.ts` | 默认 background 改为 `#e8ecf0`，ambientIntensity 0.9，dirIntensity 1.5 |
| 3 | `presets/factory/` | 视需要：背景改为 `scene.background` 纯色，或保持 CSS 渐变但调亮；增加 environment 支持 |

### 4.2 应用层（apps/demo-view）

| 任务 | 文件 | 说明 |
|------|------|------|
| 4 | `useAssetEditor.ts` | applyPreset(basicPreset, { background, ambientIntensity, dirIntensity, environment }) |
| 5 | `AssetViewer.vue` | 同上，使用 DEFAULT_SCENE_ENV |
| 6 | `useSceneEditor.ts` | factoryPreset 传入明亮 lighting、background、environment |
| 7 | `SceneViewer.vue` | 同上 |

### 4.3 资源

| 任务 | 说明 |
|------|------|
| 8 | 将 `IndoorEnvironmentHDRI005_1K_HDR.exr` 复制到 `public/`，或配置 Vite 以支持 `?url` 引入 exr |

### 4.4 配置面板 UI

| 任务 | 文件 | 说明 |
|------|------|------|
| 9 | `SceneRightPanel.vue` | 基本配置中增加「背景」区块：类型（颜色/图片/全景图）、颜色选择；「模型灯光」区块：环境光、平行光、环境贴图强度 |
| 10 | `PropertyPanel.vue` | 新增「环境」Tab：背景（类型、颜色）、模型灯光（环境光、平行光、环境贴图强度） |
| 11 | `useSceneEditor` / `useAssetEditor` | 提供 `sceneEnv`、`updateSceneEnv` 供面板实时更新 |

---

## 5. 技术要点

- **EXRLoader**：`three/examples/jsm/loaders/EXRLoader.js`
- **PMREMGenerator**：`scene.environment = pmremGenerator.fromEquirectangular(texture).texture`，记得 `texture.dispose()`
- **basicPreset**：已有 background、ambientIntensity、dirIntensity，扩展 options 增加 environment 字段
- **factoryPreset**：背景在 container CSS，若统一为纯色可改 `scene.background`；environment 需在 setup 中加载并设置

---

## 6. Background / Environment / 灯光 关系（简要）

| 项 | Three.js | 作用 |
|----|----------|------|
| 背景 | `scene.background` | 视口底色，本需求用纯色 |
| 环境 | `scene.environment` | IBL + 反射，用 HDR 照亮物体 |
| 灯光 | AmbientLight、DirectionalLight | 直接照明 |

亮度 ≈ 灯光 + environment 的 IBL，background 只影响背景区域视觉。

---

## 7. 配置面板说明

在编辑器右侧面板中（场景编辑器：基本配置；资产编辑器：环境 Tab）提供：

- **背景**：类型选择（颜色 / 图片 / 全景图）；颜色模式下可调色；图片/全景图为占位，后续实现
- **模型灯光**：环境光强度、平行光强度、环境贴图强度，支持数值输入与 +/- 步进

UI 基于当前项目样式（section-title、field-group、number-input-wrap 等），不要求完全复刻参考图。

---

## 8. 可选后续（P1+）

- 图片/全景图选择与加载
- 场景 customData 持久化 lighting / background / environment
