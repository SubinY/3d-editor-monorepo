/** gizmo 变换结束 → transformNode；拒绝则回滚 Object3D */
import type * as THREE from 'three'
import type { EditorDocument } from '../../../document/EditorDocument'
import type { TransformJSON } from '../../../document/types'
import type { ThreeRuntime, TransformSnapshot } from '../runtime/ThreeRuntime'
import { findNodePath } from '../utils/node-path'

const SOURCE = 'viewport3d'

export interface TransformBridgeOptions {
  doc: EditorDocument
  runtime: ThreeRuntime
  applyTransformToObject: (object: THREE.Object3D, transform: TransformJSON) => void
}

/** gizmo 拖拽结束 → doc.commands.transformNode；拒绝则回滚 Object3D */
export function createTransformBridge(opts: TransformBridgeOptions) {
  return ({ id }: { id: string; before: TransformSnapshot; after: TransformSnapshot }): void => {
    const attached = opts.runtime.getAttachedObject()
    if (!attached || attached.uuid !== id) return
    const path = findNodePath(attached)
    if (!path) return
    const nodeId = path.split('/')[0]
    const node = opts.doc.getNode(nodeId)
    if (!node) return

    const result = opts.doc.commands.transformNode(
      nodeId,
      {
        position: [...attached.position.toArray()] as [number, number, number],
        rotation: [attached.rotation.x, attached.rotation.y, attached.rotation.z],
        scale: [...attached.scale.toArray()] as [number, number, number]
      },
      { source: SOURCE }
    )
    if (!result.ok) {
      opts.applyTransformToObject(attached, node.transform)
    }
  }
}
