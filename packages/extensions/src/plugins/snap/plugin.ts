import type { CoreContext, EnginePlugin, TransformEvent } from '@3d-editor/engine'
import { SnapSystem, type SnapOptions } from './SnapSystem'

export const createSnapPlugin = (options: SnapOptions = {}): EnginePlugin => {
  const snap = new SnapSystem(options)
  return {
    name: 'snap',
    onTransform: (_ctx: CoreContext, payload: TransformEvent) => {
      if (!payload.object) return
      payload.object.position.copy(snap.snapPosition(payload.object.position.clone()))
      payload.object.rotation.copy(snap.snapRotation(payload.object.rotation.clone()))
    },
    dispose: () => {
      snap.updateOptions({ enabled: false })
    }
  }
}
