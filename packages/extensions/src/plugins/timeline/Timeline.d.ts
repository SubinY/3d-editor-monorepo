import type { TimelineSchema, Track, Keyframe } from '@3d-editor/editor';
export declare class Timeline {
    data: TimelineSchema;
    constructor(schema?: Partial<TimelineSchema>);
    addTrack(track: Track): void;
    addKeyframe(trackId: string, keyframe: Keyframe): void;
}
//# sourceMappingURL=Timeline.d.ts.map