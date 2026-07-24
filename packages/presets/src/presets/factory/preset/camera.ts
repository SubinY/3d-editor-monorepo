import * as THREE from 'three'
import type { CoreContext } from '@3d-editor/editor'
import type { FactoryPresetOptions } from './types'

export function configureCamera(
  ctx: CoreContext,
  options?: FactoryPresetOptions['camera']
) {
  const camera = ctx.cameraManager.camera as THREE.PerspectiveCamera
  
  camera.fov = options?.fov ?? 40
  const position = options?.position ?? [0, 60, 100]
  camera.position.set(position[0], position[1], position[2])
  
  const target = options?.target ?? [0, 0, 0]
  camera.lookAt(target[0], target[1], target[2])
  camera.updateProjectionMatrix()
  
  // 更新轨道控制器
  if (ctx.orbit) {
    ctx.orbit.controls.target.set(target[0], target[1], target[2])
    ctx.orbit.controls.update()
  }
}

