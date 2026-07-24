import type { EnginePlugin } from "@3d-editor/editor";
import { Timeline } from "./Timeline";
export interface TimelinePluginOptions {
    timeline?: Timeline;
    autoPlay?: boolean;
    onTick?: (time: number, timeline: Timeline) => void;
    /** �Ƿ��Զ���ʱ��������д�س����������� */
    autoApply?: boolean;
}
export declare const createTimelinePlugin: (options?: TimelinePluginOptions) => EnginePlugin;
//# sourceMappingURL=plugin.d.ts.map