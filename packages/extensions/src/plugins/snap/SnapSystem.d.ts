import * as THREE from 'three';
export interface SnapOptions {
    enabled?: boolean;
    gridSize?: number;
    angleStep?: number;
}
export declare class SnapSystem {
    private options;
    constructor(options?: SnapOptions);
    updateOptions(options: SnapOptions): void;
    snapPosition(position: THREE.Vector3): THREE.Vector3;
    snapRotation(rotation: THREE.Euler): THREE.Euler;
    private snapAngle;
}
//# sourceMappingURL=SnapSystem.d.ts.map