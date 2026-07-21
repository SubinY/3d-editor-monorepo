export type EffectType = 'bloom' | 'fxaa' | 'ssao' | 'ssr' | 'dof'

export interface EffectConfig {
  type: EffectType
  enabled: boolean
  params?: Record<string, number | boolean | string>
}

/**
 * Placeholder 后处理配置管线：收集效果配置，需结合 postprocessing/three-stdlib 等库映射为实际 Pass。
 */
export class EffectPipeline {
  public effects: EffectConfig[] = []

  addEffect(config: EffectConfig): void {
    this.effects.push(config)
  }
}
