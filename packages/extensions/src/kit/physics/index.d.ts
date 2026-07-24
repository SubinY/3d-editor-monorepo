import type { PhysicsBodySchema } from '@3d-editor/editor';
export interface PhysicsBodyHandle {
    id: string;
    schema: PhysicsBodySchema;
}
/**
 * Placeholder 物理世界描述器：仅存储 schema，不包含实际物理求解。
 * 建议结合 Cannon.js / Ammo.js / Rapier 等引擎完成运行时。
 */
export declare class PhysicsWorld {
    private bodies;
    addBody(schema: PhysicsBodySchema): PhysicsBodyHandle;
    removeBody(id: string): void;
    step(_delta: number): void;
}
//# sourceMappingURL=index.d.ts.map