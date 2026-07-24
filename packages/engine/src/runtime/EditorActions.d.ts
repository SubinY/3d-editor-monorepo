import * as THREE from 'three';
import type { AlignType, AlignmentTool } from '../editing/tools/AlignmentTool';
import type { SceneGraphManager } from '../editing/scene/SceneGraphManager';
import type { SelectionManager } from '../editing/interaction/SelectionManager';
import type { EventBus } from './EventBus';
import type { HistoryManager } from '../editing/history/HistoryManager';
interface AddOptions {
    parent?: THREE.Object3D;
    select?: boolean;
    description?: string;
}
interface RemoveOptions {
    deselect?: boolean;
    description?: string;
}
/**
 * 官方“动作层”，将常用编辑操作（增删、成组、对齐）与 History / EventBus / SceneGraph 绑定，减少业务侧心智负担。
 */
export declare class EditorActions {
    private scene;
    private history;
    private sceneGraph;
    private alignment;
    private selection;
    private eventBus;
    constructor(scene: THREE.Scene, history: HistoryManager, sceneGraph: SceneGraphManager, alignment: AlignmentTool, selection: SelectionManager, eventBus: EventBus);
    setScene(scene: THREE.Scene): void;
    addObject(object: THREE.Object3D, options?: AddOptions): void;
    removeObject(object: THREE.Object3D, options?: RemoveOptions): void;
    group(objects: THREE.Object3D[]): THREE.Group | null;
    ungroup(group: THREE.Group): THREE.Object3D[];
    align(objects: THREE.Object3D[], type: AlignType): void;
}
export {};
//# sourceMappingURL=EditorActions.d.ts.map