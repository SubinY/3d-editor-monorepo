import type { EnginePlugin } from '@3d-editor/editor';
import { type PerformanceStats } from './PerformanceMonitor';
export interface PerformancePluginOptions {
    onUpdate?: (stats: PerformanceStats) => void;
    name?: string;
}
export declare const createPerformancePlugin: (options?: PerformancePluginOptions) => EnginePlugin;
//# sourceMappingURL=plugin.d.ts.map