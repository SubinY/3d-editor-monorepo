import type * as ThreeNS from 'three'
import { MH_ASSET_HANDLE_KEY } from '@mh/3d-editor'
import { bakeToCanvas } from './bake'
import { createDefaultContent, isContent } from './content'
import type { PanelBillboardMode, PanelContentJSON, PanelHandle } from './types'

const USERDATA_KEY = 'mhInfoPanel'

function resolveBillboard(content: PanelContentJSON): PanelBillboardMode {
  return content.billboard ?? 'yaw'
}

/**
 * 信息面板：Plane + 可选广告牌朝向（资产内 onBeforeRender，不依赖 editor 内核）。
 * - none：固定朝向
 * - yaw：仅绕 Y 水平面向相机（默认）
 * - full：完全面向相机
 */
export async function createModel(
  THREE: typeof ThreeNS,
  content?: PanelContentJSON
): Promise<PanelHandle> {
  const panel = isContent(content) ? content : createDefaultContent()
  let canvas = await bakeToCanvas(panel)
  let texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  })

  // 底边中心为锚点（对齐原 Sprite center(0.5,0)）
  const geometry = new THREE.PlaneGeometry(1, 1)
  geometry.translate(0, 0.5, 0)

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'info-panel-plane'
  mesh.castShadow = false
  mesh.receiveShadow = false

  const w = panel.worldWidth ?? 1.6
  const h = w * (panel.height / Math.max(panel.width, 1))
  mesh.scale.set(w, h, 1)

  let billboard = resolveBillboard(panel)
  const camWorld = new THREE.Vector3()
  const objWorld = new THREE.Vector3()
  const parentPos = new THREE.Vector3()
  const parentQuat = new THREE.Quaternion()
  const parentScale = new THREE.Vector3()
  const parentEuler = new THREE.Euler()

  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    if (billboard === 'none') {
      mesh.rotation.set(0, 0, 0)
      return
    }
    camera.getWorldPosition(camWorld)
    mesh.getWorldPosition(objWorld)
    if (billboard === 'full') {
      mesh.lookAt(camWorld)
      return
    }
    // yaw：世界方位角减去父级 Y，得到本地绕 Y
    const worldYaw = Math.atan2(camWorld.x - objWorld.x, camWorld.z - objWorld.z)
    let parentYaw = 0
    if (mesh.parent) {
      mesh.parent.matrixWorld.decompose(parentPos, parentQuat, parentScale)
      parentEuler.setFromQuaternion(parentQuat, 'YXZ')
      parentYaw = parentEuler.y
    }
    mesh.rotation.set(0, worldYaw - parentYaw, 0)
  }

  const root = new THREE.Group()
  root.name = 'info-panel'
  root.add(mesh)

  let applyToken = 0

  const handle: PanelHandle = {
    root,
    sprite: mesh,
    apply: async next => {
      const token = ++applyToken
      billboard = resolveBillboard(next)

      const nextW = Math.max(64, Math.floor(next.width))
      const nextH = Math.max(64, Math.floor(next.height))
      const sizeChanged = canvas.width !== nextW || canvas.height !== nextH

      const target = sizeChanged ? undefined : canvas
      const baked = await bakeToCanvas(next, target)
      if (token !== applyToken) return

      if (sizeChanged) {
        canvas = baked
        texture.dispose()
        texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        material.map = texture
        material.needsUpdate = true
      } else {
        texture.needsUpdate = true
      }

      const nw = next.worldWidth ?? 1.6
      const nh = nw * (next.height / Math.max(next.width, 1))
      mesh.scale.set(nw, nh, 1)
    },
    dispose: () => {
      applyToken++
      mesh.onBeforeRender = () => {}
      texture.dispose()
      material.dispose()
      geometry.dispose()
    }
  }
  root.userData[USERDATA_KEY] = handle
  mesh.userData[USERDATA_KEY] = handle
  root.userData[MH_ASSET_HANDLE_KEY] = {
    apply: (props: Record<string, unknown> | undefined) => {
      const raw = props?.panel
      const next = isContent(raw) ? raw : createDefaultContent()
      return handle.apply(next)
    },
    dispose: () => handle.dispose()
  }
  return handle
}

/** 刷新已挂到节点上的面板贴图（调试/特殊路径；常规编辑走 Viewport3D props 同步） */
export async function applyToObject(
  root: ThreeNS.Object3D | undefined,
  content: PanelContentJSON
): Promise<boolean> {
  if (!root) return false
  const direct = root.userData[USERDATA_KEY] as PanelHandle | undefined
  if (direct?.apply) {
    await direct.apply(content)
    return true
  }
  let found = false
  const jobs: Promise<void>[] = []
  root.traverse(obj => {
    const h = obj.userData[USERDATA_KEY] as PanelHandle | undefined
    if (h?.apply) {
      jobs.push(h.apply(content))
      found = true
    }
  })
  await Promise.all(jobs)
  return found
}
