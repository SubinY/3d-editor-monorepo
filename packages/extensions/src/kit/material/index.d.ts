import * as THREE from 'three';
export interface MaterialOptions {
    color?: string;
    metalness?: number;
    roughness?: number;
    map?: string;
}
/**
 * 实用材质编辑器：帮助在属性面板中快速应用 MeshStandardMaterial。
 */
export declare class MaterialEditor {
    applyStandardMaterial(object: THREE.Object3D, options: MaterialOptions): Promise<void>;
    private loadTexture;
}
//# sourceMappingURL=index.d.ts.map