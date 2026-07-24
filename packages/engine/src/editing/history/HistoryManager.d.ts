import type { HistoryOptions, HistorySnapshot } from '../../types';
export interface Command {
    execute(): void;
    undo(): void;
    redo(): void;
    description?: string;
}
export declare class HistoryManager {
    private undoStack;
    private redoStack;
    private snapshots;
    private options;
    private currentTransaction;
    constructor(options?: HistoryOptions);
    execute(command: Command): void;
    undo(): boolean;
    redo(): boolean;
    pushSnapshot(snapshot: HistorySnapshot): void;
    getState(): {
        canUndo: boolean;
        canRedo: boolean;
    };
    private trim;
    beginTransaction(description: string): void;
    endTransaction(): void;
    cancelTransaction(): void;
    recordTransform(_objectId: string, before: unknown, after: unknown): void;
}
//# sourceMappingURL=HistoryManager.d.ts.map