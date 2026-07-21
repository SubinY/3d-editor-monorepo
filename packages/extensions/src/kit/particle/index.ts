export interface ParticleEmitterOptions {
  rate: number
  lifetime: number
  velocity: [number, number, number]
}

/**
 * Placeholder 粒子发射器：保存配置，需结合自研或三方粒子系统实现渲染。
 */
export class ParticleEmitter {
  public options: ParticleEmitterOptions

  constructor(options: ParticleEmitterOptions) {
    this.options = options
  }
}
