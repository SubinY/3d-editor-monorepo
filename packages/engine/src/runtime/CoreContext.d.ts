import * as THREE from 'three';
import { Renderer, RendererOptions } from './Renderer';
import { RenderLoop } from './RenderLoop';
import { CameraManager } from './CameraManager';
import { EventBus } from './EventBus';
import { OrbitController } from '../editing/controls/OrbitController';
import { TransformController } from '../editing/controls/TransformController';
import { SelectionManager } from '../editing/interaction/SelectionManager';
import { HistoryManager } from '../editing/history/HistoryManager';
import { AnimationSystem } from '../animation/AnimationSystem';
import { SceneSerializer } from '../io/SceneSerializer';
import { AxisHelper } from '../editing/helpers/AxisHelper';
import { SceneGraphManager } from '../editing/scene/SceneGraphManager';
import { AlignmentTool } from '../editing/tools/AlignmentTool';
import { SelectionHighlight } from '../editing/effects/SelectionHighlight';
import { PluginManager, type EnginePlugin } from './PluginManager';
import { PresetManager, type ScenePreset, type AppliedPreset } from './PresetManager';
import { EditorActions } from './EditorActions';
import type { ControlAdapter } from '../editing/controls/ControlAdapter';
import type { RendererOptionsSchema, SceneSchema } from '../types';
export interface CoreContextOptions {
    container: HTMLElement;
    rendererOptions?: RendererOptions | RendererOptionsSchema;
    controls?: {
        factory?: (camera: THREE.Camera, dom: HTMLElement) => ControlAdapter;
    };
    plugins?: EnginePlugin[];
    presets?: ScenePreset[];
    history?: {
        /**
         * 拖拽结束后是否自动写入 engine 自身的 HistoryManager。
         * 上层若以外部 Document 命令栈为唯一历史（如 @3d-editor/editor），应设为 false，
         * engine 侧降级为执行器，仅继续派发 OBJECT_TRANSFORMED 事件。
         */
        autoRecordTransform?: boolean;
    };
}
export declare class CoreContext {
    scene: THREE.Scene;
    renderer: Renderer;
    renderLoop: RenderLoop;
    cameraManager: CameraManager;
    controls: ControlAdapter;
    orbit?: OrbitController;
    transform: TransformController;
    selection: SelectionManager;
    history: HistoryManager;
    animation: AnimationSystem;
    serializer: SceneSerializer;
    eventBus: EventBus;
    pluginManager: PluginManager;
    axisHelper: AxisHelper;
    sceneGraph: SceneGraphManager;
    alignment: AlignmentTool;
    highlight: SelectionHighlight;
    actions: EditorActions;
    presetManager: PresetManager;
    private transformBefore?;
    private autoRecordTransform;
    constructor(options: CoreContextOptions);
    dispose(): void;
    loadScene(schema: SceneSchema): void;
    serializeScene(extras?: Partial<SceneSchema>): SceneSchema;
    applyPreset<TOptions = unknown, TState = unknown>(presetOrId: ScenePreset<TOptions, TState> | string, options?: TOptions): Promise<AppliedPreset<TState>>;
    private handleResize;
    private handleTransformChange;
    private handleDraggingChanged;
    private captureTransform;
}
//# sourceMappingURL=CoreContext.d.ts.map