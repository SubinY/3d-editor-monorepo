import type { CoreContext } from '@3d-editor/editor';
import type { Timeline } from './Timeline';
/**
 * 将 Timeline 数据驱动到 Three.js 对象属性的轻量播放器。
 * 当前实现支持 number / vector3 / color / quaternion 的线性插值。
 */
export declare class TimelinePlayer {
    private ctx;
    private timeline;
    constructor(ctx: CoreContext, timeline: Timeline);
    apply(time: number): void;
    private interpolate;
    private lerpValues;
    private lerpNumber;
    private applyValue;
}
//# sourceMappingURL=TimelinePlayer.d.ts.map