import * as THREE from 'three';
export type AlignType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v';
export declare class AlignmentTool {
    align(objects: THREE.Object3D[], type: AlignType): void;
    private distribute;
    private getBox;
}
//# sourceMappingURL=AlignmentTool.d.ts.map