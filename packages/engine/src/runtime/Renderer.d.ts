import * as THREE from 'three';
import type { RendererOptionsSchema } from '../types';
export type RendererOptions = RendererOptionsSchema;
export declare class Renderer {
    renderer: THREE.WebGLRenderer;
    constructor(container: HTMLElement, options?: RendererOptions);
    get domElement(): HTMLCanvasElement;
    render(scene: THREE.Scene, camera: THREE.Camera): void;
    setSize(width: number, height: number): void;
    dispose(): void;
}
//# sourceMappingURL=Renderer.d.ts.map