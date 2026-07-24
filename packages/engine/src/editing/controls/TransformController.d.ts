import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { ControlMode } from '../../types';
export declare class TransformController {
    controls: TransformControls;
    private attachedObject;
    private multiSelectionGroup;
    private originalParents;
    private currentMode;
    constructor(camera: THREE.Camera, dom: HTMLElement);
    setMode(mode: ControlMode): void;
    getMode(): ControlMode;
    attach(object: THREE.Object3D | null): void;
    /**
     * 附加多个对象（通过创建临时Group）
     */
    attachMultiple(objects: THREE.Object3D[]): void;
    /**
     * 应用Group的变换到所有子对象并解散Group
     */
    private dissolveMultiSelectionGroup;
    private detachInternal;
    private isChildOfControls;
    /**
     * 获取当前附加的对象
     */
    getAttachedObject(): THREE.Object3D | null;
    /**
     * 获取是否处于多选模式
     */
    isMultiSelection(): boolean;
    dispose(): void;
}
//# sourceMappingURL=TransformController.d.ts.map