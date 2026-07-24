import type * as THREE from 'three';
import type { ControlMode, SceneSchema } from '../types';
import type { CoreContext } from './CoreContext';
export interface TransformEvent {
    object: THREE.Object3D | null;
    mode: ControlMode;
}
export interface SelectionEvent {
    selection: THREE.Object3D[];
}
export type PluginCleanup = () => void;
export interface EnginePlugin {
    name: string;
    setup?(ctx: CoreContext): void | PluginCleanup;
    onBeforeRender?(ctx: CoreContext, delta: number): void;
    onAfterRender?(ctx: CoreContext, delta: number): void;
    onSelectionChanged?(ctx: CoreContext, payload: SelectionEvent): void;
    onTransform?(ctx: CoreContext, payload: TransformEvent): void;
    onSceneSerialized?(schema: SceneSchema): void;
    onSceneDeserialized?(schema: SceneSchema): void;
    dispose?(): void;
}
export declare class PluginManager {
    private plugins;
    register(plugin: EnginePlugin, ctx: CoreContext): void;
    registerMany(plugins: EnginePlugin[], ctx: CoreContext): void;
    unregister(name: string): void;
    emitBeforeRender(ctx: CoreContext, delta: number): void;
    emitAfterRender(ctx: CoreContext, delta: number): void;
    emitSelectionChanged(ctx: CoreContext, payload: SelectionEvent): void;
    emitTransform(ctx: CoreContext, payload: TransformEvent): void;
    emitSceneSerialized(schema: SceneSchema): void;
    emitSceneDeserialized(schema: SceneSchema): void;
    disposeAll(): void;
}
//# sourceMappingURL=PluginManager.d.ts.map