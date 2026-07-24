import * as THREE from 'three';
import type { CameraSchema } from '../types';
export declare class CameraManager {
    camera: THREE.PerspectiveCamera;
    constructor(container: HTMLElement, fov?: number, near?: number, far?: number);
    updateAspect(width: number, height: number): void;
    serialize(): CameraSchema;
    setCamera(camera: THREE.PerspectiveCamera): void;
}
//# sourceMappingURL=CameraManager.d.ts.map