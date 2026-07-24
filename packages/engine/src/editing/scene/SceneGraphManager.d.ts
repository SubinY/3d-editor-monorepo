import * as THREE from 'three';
export declare class SceneGraphManager {
    private scene;
    constructor(scene: THREE.Scene);
    setScene(scene: THREE.Scene): void;
    group(objects: THREE.Object3D[]): THREE.Group;
    ungroup(group: THREE.Group): THREE.Object3D[];
    setParent(child: THREE.Object3D, parent: THREE.Object3D | THREE.Scene): void;
    setVisible(object: THREE.Object3D, visible: boolean): void;
    setLocked(object: THREE.Object3D, locked: boolean): void;
    isLocked(object: THREE.Object3D): boolean;
    /**
     * 判断对象是否是编辑器创建的组
     */
    isGroup(object: THREE.Object3D): boolean;
    /**
     * 查找对象所属的最顶层编辑器组（如果有）
     */
    findParentGroup(object: THREE.Object3D): THREE.Group | null;
}
//# sourceMappingURL=SceneGraphManager.d.ts.map