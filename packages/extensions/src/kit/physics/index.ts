import type { PhysicsBodySchema } from '@3d-editor/editor'

export interface PhysicsBodyHandle {
  id: string
  schema: PhysicsBodySchema
}

/**
 * Placeholder 物理世界描述器：仅存储 schema，不包含实际物理求解。
 * 建议结合 Cannon.js / Ammo.js / Rapier 等引擎完成运行时。
 */
export class PhysicsWorld {
  private bodies: Map<string, PhysicsBodyHandle> = new Map()

  addBody(schema: PhysicsBodySchema): PhysicsBodyHandle {
    const id = `body-${Date.now()}-${this.bodies.size}`
    const handle = { id, schema }
    this.bodies.set(id, handle)
    return handle
  }

  removeBody(id: string): void {
    this.bodies.delete(id)
  }

  step(_delta: number): void {
    // placeholder for physics step
  }
}
