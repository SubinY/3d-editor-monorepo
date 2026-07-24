import type * as THREE from 'three';
export interface ControlAdapter {
    type: string;
    update(delta?: number): void;
    dispose(): void;
    setEnabled?(enabled: boolean): void;
    getCamera?(): THREE.Camera | null;
}
//# sourceMappingURL=ControlAdapter.d.ts.map