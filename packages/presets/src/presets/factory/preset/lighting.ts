import * as THREE from 'three'
import type { CoreContext } from '@3d-editor/editor'
import type { FactoryPresetOptions, FactoryPresetState } from './types'

function setNonSelectable(obj: THREE.Object3D) {
  obj.traverse(child => {
    child.userData = child.userData ?? {}
    child.userData.nonSelectable = true
    child.raycast = () => {}
  })
}

export function setupLights(
  ctx: CoreContext,
  floorSize: { width: number; depth: number },
  options?: FactoryPresetOptions['lighting']
): Pick<FactoryPresetState, 'lights' | 'lightTarget' | 'updateLightShadowBounds'> {
  const lights: THREE.Light[] = []
  
  // 环境光
  const ambientColor = options?.ambientColor ?? '#bbdefb'
  const ambientIntensity = options?.ambientIntensity ?? 0.4
  const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity)
  setNonSelectable(ambient)
  ctx.scene.add(ambient)
  lights.push(ambient)
  
  // 主方向光
  const mainColor = options?.mainColor ?? '#ffffff'
  const mainIntensity = options?.mainIntensity ?? 0.8
  const mainPosition = options?.mainPosition ?? [0, 100, 0]
  
  const dir = new THREE.DirectionalLight(mainColor, mainIntensity)
  dir.position.set(mainPosition[0], mainPosition[1], mainPosition[2])
  dir.castShadow = true
  
  const shadowMapSize = options?.shadowMapSize ?? 2048
  dir.shadow.mapSize.set(shadowMapSize, shadowMapSize)
  dir.shadow.camera.near = 1
  dir.shadow.camera.far = 400
  
  // 创建光源目标
  const target = new THREE.Object3D()
  target.position.set(0, 0, 0)
  setNonSelectable(target)
  ctx.scene.add(target)
  dir.target = target
  
  setNonSelectable(dir)
  ctx.scene.add(dir)
  lights.push(dir)
  
  // 启用阴影
  ctx.renderer.renderer.shadowMap.enabled = true
  ctx.renderer.renderer.shadowMap.type = THREE.PCFSoftShadowMap
  
  // 更新阴影边界的函数
  const updateLightShadowBounds = () => {
    const range = Math.max(floorSize.width, floorSize.depth)
    const cam = dir.shadow.camera as THREE.OrthographicCamera
    cam.left = -range
    cam.right = range
    cam.top = range
    cam.bottom = -range
    cam.updateProjectionMatrix()
  }
  
  // 初始化阴影边界
  updateLightShadowBounds()
  
  return {
    lights,
    lightTarget: target,
    updateLightShadowBounds
  }
}

