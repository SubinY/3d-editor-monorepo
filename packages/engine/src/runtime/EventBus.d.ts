export type EventHandler<T = unknown> = (payload?: T) => void;
export declare class EventBus {
    private listeners;
    on<T = unknown>(event: string, handler: EventHandler<T>): void;
    off<T = unknown>(event: string, handler: EventHandler<T>): void;
    emit<T = unknown>(event: string, payload?: T): void;
    once<T = unknown>(event: string, handler: EventHandler<T>): void;
}
export declare const EditorEvents: {
    readonly OBJECT_SELECTED: "object:selected";
    readonly OBJECT_TRANSFORMED: "object:transformed";
    readonly OBJECT_ADDED: "object:added";
    readonly OBJECT_REMOVED: "object:removed";
    readonly SCENE_UPDATED: "scene:updated";
    readonly TOOL_CHANGED: "tool:changed";
};
export type EditorEventName = (typeof EditorEvents)[keyof typeof EditorEvents];
//# sourceMappingURL=EventBus.d.ts.map