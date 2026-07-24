import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type * as THREE from 'three';
import type { ControlAdapter } from './ControlAdapter';
export declare class OrbitController implements ControlAdapter {
    controls: OrbitControls;
    readonly type = "orbit";
    constructor(camera: THREE.Camera, dom: HTMLElement);
    update(): void;
    setEnabled(enabled: boolean): void;
    getCamera(): THREE.Camera;
    dispose(): void;
}
//# sourceMappingURL=OrbitController.d.ts.map