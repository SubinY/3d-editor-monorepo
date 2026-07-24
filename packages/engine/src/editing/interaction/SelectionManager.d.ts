import * as THREE from "three";
import { EventBus } from "../../runtime/EventBus";
export interface SelectionResult {
    object: THREE.Object3D | null;
    point?: THREE.Vector3;
}
export declare class SelectionManager {
    private raycaster;
    private pointer;
    private camera;
    private selectedObjects;
    private sceneGraphManager?;
    private eventBus?;
    onSelectionChanged?: (selection: THREE.Object3D[]) => void;
    constructor(camera: THREE.Camera, eventBus?: EventBus);
    setSceneGraphManager(manager: any): void;
    pick(clientX: number, clientY: number, dom: HTMLElement, objects: THREE.Object3D[]): SelectionResult;
    select(object: THREE.Object3D, additive?: boolean): void;
    deselect(object: THREE.Object3D): void;
    clear(): void;
    getSelection(): THREE.Object3D[];
    getSelectionIds(): string[];
    getSelectionCount(): number;
    isSelected(object: THREE.Object3D): boolean;
    toggle(object: THREE.Object3D): void;
    private notifyChanged;
}
//# sourceMappingURL=SelectionManager.d.ts.map