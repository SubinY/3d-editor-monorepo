import * as THREE from 'three';
export interface AxisHelperOptions {
    size?: number;
    viewportSize?: number;
}
export declare class AxisHelper {
    worldAxis: THREE.AxesHelper;
    private viewportAxis;
    private viewportScene;
    private viewportCamera;
    private renderer;
    private enabled;
    constructor(renderer: THREE.WebGLRenderer, options?: AxisHelperOptions);
    setEnabled(enabled: boolean): void;
    update(camera: THREE.Camera): void;
}
//# sourceMappingURL=AxisHelper.d.ts.map