import * as THREE from 'three';
export interface SelectionHighlightOptions {
    color?: THREE.ColorRepresentation;
    thickness?: number;
    pulsate?: boolean;
}
/**
 * 选中对象的高亮描边效果
 * 使用 Line2 实现真正的加粗描边
 */
export declare class SelectionHighlight {
    private highlightedObjects;
    private renderer;
    private color;
    private thickness;
    private pulsate;
    private pulsateTime;
    constructor(_scene: THREE.Scene, _camera: THREE.Camera, renderer: THREE.WebGLRenderer, options?: SelectionHighlightOptions);
    /**
     * 为对象添加高亮效果
     */
    add(object: THREE.Object3D): void;
    /**
     * 移除对象的高亮效果
     */
    remove(object: THREE.Object3D): void;
    /**
     * 清除所有高亮
     */
    clear(): void;
    /**
     * 更新高亮对象列表
     */
    setHighlightedObjects(objects: THREE.Object3D[]): void;
    /**
     * 更新动画效果（脉动）
     */
    update(delta: number): void;
    /**
     * 设置高亮颜色
     */
    setColor(color: THREE.ColorRepresentation): void;
    /**
     * 更新渲染器大小（用于 LineMaterial 的分辨率）
     */
    setSize(width: number, height: number): void;
    /**
     * 更新场景（兼容性保留）
     */
    setScene(_scene: THREE.Scene): void;
    /**
     * 更新相机（兼容性保留）
     */
    setCamera(_camera: THREE.Camera): void;
    /**
     * 清理资源
     */
    dispose(): void;
    private isHighlightable;
}
//# sourceMappingURL=SelectionHighlight.d.ts.map