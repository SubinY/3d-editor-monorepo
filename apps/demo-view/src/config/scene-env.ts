/**
 * 默认场景环境配置（demand-v3）
 * 背景纯色 + HDR environment（IBL）+ 灯光
 */
export const DEFAULT_SCENE_ENV = {
  background: '#e8ecf0',
  ambientIntensity: 0.9,
  dirIntensity: 1.5,
  dirPosition: [8, 15, 10] as [number, number, number],
  environment: {
    url: '/IndoorEnvironmentHDRI005_1K_HDR.exr',
    intensity: 1.0
  }
} as const

/** factoryPreset 用：明亮默认；intensity 降低避免 EXR 过曝全白 */
export const DEFAULT_FACTORY_ENV = {
  background: { color: '#e8ecf0' },
  lighting: {
    ambientColor: '#ffffff',
    ambientIntensity: 0.9,
    mainColor: '#ffffff',
    mainIntensity: 1.5,
    mainPosition: [0, 100, 0] as [number, number, number]
  },
  environment: {
    url: '/IndoorEnvironmentHDRI005_1K_HDR.exr',
    intensity: 0.4
  }
} as const
