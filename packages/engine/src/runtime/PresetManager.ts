import type { CoreContext } from './CoreContext'

export interface ScenePreset<TOptions = unknown, TState = unknown> {
  id: string
  label?: string
  setup: (ctx: CoreContext, options?: TOptions) => Promise<TState | void> | TState | void
  dispose?: (ctx: CoreContext, state?: TState) => void
}

export interface AppliedPreset<TState = unknown> {
  preset: ScenePreset<any, TState>
  state?: TState
}

export class PresetManager {
  private presets = new Map<string, ScenePreset>()
  private active?: AppliedPreset

  public register(preset: ScenePreset): void {
    this.presets.set(preset.id, preset)
  }

  public registerMany(presets: ScenePreset[]): void {
    presets.forEach(preset => this.register(preset))
  }

  public get(id: string): ScenePreset | undefined {
    return this.presets.get(id)
  }

  public getActive(): AppliedPreset | undefined {
    return this.active
  }

  public disposeActive(ctx: CoreContext): void {
    if (this.active?.preset.dispose) {
      this.active.preset.dispose(ctx, this.active.state)
    }
    this.active = undefined
  }

  public async apply<TOptions = unknown, TState = unknown>(
    ctx: CoreContext,
    presetOrId: ScenePreset<TOptions, TState> | string,
    options?: TOptions
  ): Promise<AppliedPreset<TState>> {
    const preset =
      typeof presetOrId === 'string' ? (this.presets.get(presetOrId) as ScenePreset<TOptions, TState> | undefined) : presetOrId

    if (!preset) {
      throw new Error(`Preset "${presetOrId}" not found`)
    }

    this.disposeActive(ctx)

    const state = (await preset.setup(ctx, options)) as TState | undefined
    const applied: AppliedPreset<TState> = { preset, state }
    this.active = applied as AppliedPreset
    return applied
  }
}
