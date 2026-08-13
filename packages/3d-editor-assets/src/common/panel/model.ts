import type * as ThreeNS from 'three'
import { bakeToCanvas } from './bake'
import { createDefaultContent, isContent } from './content'
import type { PanelContentJSON, PanelHandle } from './types'

const USERDATA_KEY = 'mhInfoPanel'

/** 创建始终朝向相机的信息面板 Sprite */
export async function createModel(
  THREE: typeof ThreeNS,
  content?: PanelContentJSON
): Promise<PanelHandle> {
  const panel = isContent(content) ? content : createDefaultContent()
  const canvas = await bakeToCanvas(panel)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true
  })
  const sprite = new THREE.Sprite(material)
  const w = panel.worldWidth ?? 1.6
  const h = w * (panel.height / Math.max(panel.width, 1))
  sprite.scale.set(w, h, 1)
  sprite.center.set(0.5, 0)

  const root = new THREE.Group()
  root.name = 'info-panel'
  root.add(sprite)

  const handle: PanelHandle = {
    root,
    sprite,
    apply: async next => {
      await bakeToCanvas(next, canvas)
      texture.needsUpdate = true
      const nw = next.worldWidth ?? 1.6
      const nh = nw * (next.height / Math.max(next.width, 1))
      sprite.scale.set(nw, nh, 1)
    },
    dispose: () => {
      texture.dispose()
      material.dispose()
    }
  }
  root.userData[USERDATA_KEY] = handle
  sprite.userData[USERDATA_KEY] = handle
  return handle
}

/** 刷新已挂到节点上的面板贴图 */
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
  root.traverse(obj => {
    const h = obj.userData[USERDATA_KEY] as PanelHandle | undefined
    if (h?.apply) {
      void h.apply(content)
      found = true
    }
  })
  return found
}
