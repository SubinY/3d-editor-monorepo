import type { CatalogItem } from '../catalog/types'
import type { EditorNodeJSON, TransformJSON } from './types'
import { cloneTransform } from './types'
import type { EditorDocument } from './EditorDocument'

export type ConstraintOperation = 'place' | 'transform'

export interface ConstraintInput {
  operation: ConstraintOperation
  node: EditorNodeJSON
  /** 期望应用的变换（世界/文档坐标） */
  transform: TransformJSON
  /** 节点引用的 Catalog 条目（若可解析） */
  item?: CatalogItem
}

export interface ConstraintResult {
  allowed: boolean
  reason?: string
  /** 规则可返回修正后的变换（如吸附） */
  transform?: TransformJSON
}

export interface ConstraintRule {
  id: string
  /** 返回 false / {allowed:false} 表示拒绝；返回 {transform} 表示修正 */
  evaluate(input: ConstraintInput, doc: EditorDocument): ConstraintResult | boolean
}

/**
 * 约束引擎（可选扩展点，MVP 主路径是内建 AABB 碰撞）。
 * Host 不注册任何规则时，place/transform 仅做碰撞检测。
 * 时机：交互强制；loadDocument 只产出警告不阻塞。
 */
export class ConstraintEngine {
  private rules: ConstraintRule[] = []

  register(rules: ConstraintRule | ConstraintRule[]): void {
    const list = Array.isArray(rules) ? rules : [rules]
    list.forEach(rule => {
      this.unregister(rule.id)
      this.rules.push(rule)
    })
  }

  unregister(id: string): void {
    this.rules = this.rules.filter(rule => rule.id !== id)
  }

  listRules(): ConstraintRule[] {
    return [...this.rules]
  }

  /** 依次执行规则：任一拒绝即拒绝；修正后的 transform 传递给后续规则 */
  evaluate(input: ConstraintInput, doc: EditorDocument): ConstraintResult {
    let transform = cloneTransform(input.transform)
    for (const rule of this.rules) {
      const result = rule.evaluate({ ...input, transform }, doc)
      if (result === true) continue
      if (result === false) {
        return { allowed: false, reason: rule.id }
      }
      if (!result.allowed) {
        return { allowed: false, reason: result.reason ?? rule.id }
      }
      if (result.transform) {
        transform = cloneTransform(result.transform)
      }
    }
    return { allowed: true, transform }
  }
}

/** 通用规则：节点 footprint 不越出文档 bounds（按 yaw 旋转后的包围盒近似） */
export function boundsConstraint(options?: { margin?: number }): ConstraintRule {
  const margin = options?.margin ?? 0
  return {
    id: 'core:bounds',
    evaluate(input, doc) {
      const { bounds } = doc
      const fp = input.item?.footprint
      const halfW = (fp?.width ?? 0) / 2
      const halfD = (fp?.depth ?? 0) / 2
      const yaw = input.transform.rotation[1]
      const cos = Math.abs(Math.cos(yaw))
      const sin = Math.abs(Math.sin(yaw))
      const extentX = halfW * cos + halfD * sin
      const extentZ = halfW * sin + halfD * cos

      const [x, , z] = input.transform.position
      const minX = -bounds.width / 2 + extentX + margin
      const maxX = bounds.width / 2 - extentX - margin
      const minZ = -bounds.depth / 2 + extentZ + margin
      const maxZ = bounds.depth / 2 - extentZ - margin

      if (minX > maxX || minZ > maxZ) {
        return { allowed: false, reason: 'core:bounds:item-too-large' }
      }

      const clampedX = Math.min(Math.max(x, minX), maxX)
      const clampedZ = Math.min(Math.max(z, minZ), maxZ)
      if (clampedX === x && clampedZ === z) return true

      const transform = cloneTransform(input.transform)
      transform.position[0] = clampedX
      transform.position[2] = clampedZ
      return { allowed: true, transform }
    }
  }
}

/** 通用规则：网格吸附（水平 XZ） */
export function gridSnapConstraint(options?: { size?: number }): ConstraintRule {
  const size = options?.size ?? 0.5
  return {
    id: 'core:grid-snap',
    evaluate(input) {
      const transform = cloneTransform(input.transform)
      transform.position[0] = Math.round(transform.position[0] / size) * size
      transform.position[2] = Math.round(transform.position[2] / size) * size
      return { allowed: true, transform }
    }
  }
}
