type LoopCallback = (delta: number) => void;
export declare class RenderLoop {
    private rafId;
    private lastTime;
    start(callback: LoopCallback): void;
    stop(): void;
}
export {};
//# sourceMappingURL=RenderLoop.d.ts.map