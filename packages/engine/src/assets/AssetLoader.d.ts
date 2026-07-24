import * as THREE from 'three';
export interface LoadResult {
    scene: THREE.Group | THREE.Object3D;
    animations?: THREE.AnimationClip[];
}
export declare class AssetLoader {
    loadGLTF(url: string, onProgress?: (progress: number) => void): Promise<LoadResult>;
}
//# sourceMappingURL=AssetLoader.d.ts.map