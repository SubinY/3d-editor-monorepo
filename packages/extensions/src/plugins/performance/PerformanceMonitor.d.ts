import type { CoreContext } from '@3d-editor/editor';
export interface PerformanceStats {
    fps: number;
    drawCalls: number;
    triangles: number;
}
export declare class PerformanceMonitor {
    private ctx;
    private lastTime;
    private frame;
    private fps;
    constructor(ctx: CoreContext);
    update(): PerformanceStats;
}
//# sourceMappingURL=PerformanceMonitor.d.ts.map