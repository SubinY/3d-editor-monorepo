import * as THREE from 'three';
/**
 * 统一管理“哪些对象可选/可序列化”的规则，避免 Selection 与 Serializer 分散维护。
 */
export declare const EditorObjectPolicy: {
    isHelper(object: THREE.Object3D): boolean;
    isSelectable(object: THREE.Object3D): boolean;
    isSerializable(object: THREE.Object3D): boolean;
};
//# sourceMappingURL=EditorObjectPolicy.d.ts.map