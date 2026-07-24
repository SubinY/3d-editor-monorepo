import type { CoreContext } from './CoreContext';
export interface ScenePreset<TOptions = unknown, TState = unknown> {
    id: string;
    label?: string;
    setup: (ctx: CoreContext, options?: TOptions) => Promise<TState | void> | TState | void;
    dispose?: (ctx: CoreContext, state?: TState) => void;
}
export interface AppliedPreset<TState = unknown> {
    preset: ScenePreset<any, TState>;
    state?: TState;
}
export declare class PresetManager {
    private presets;
    private active?;
    register(preset: ScenePreset): void;
    registerMany(presets: ScenePreset[]): void;
    get(id: string): ScenePreset | undefined;
    getActive(): AppliedPreset | undefined;
    disposeActive(ctx: CoreContext): void;
    apply<TOptions = unknown, TState = unknown>(ctx: CoreContext, presetOrId: ScenePreset<TOptions, TState> | string, options?: TOptions): Promise<AppliedPreset<TState>>;
}
//# sourceMappingURL=PresetManager.d.ts.map