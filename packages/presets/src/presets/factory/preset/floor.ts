import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import type { CoreContext } from '@3d-editor/engine'
import type { FactoryPresetOptions, FactoryPresetState } from './types'

function setNonSelectable(obj: THREE.Object3D) {
  obj.traverse(child => {
    child.userData = child.userData ?? {}
    child.userData.nonSelectable = true
    child.raycast = () => {}
  })
}

function clearGroup(group: THREE.Group) {
  const children = [...group.children]
  children.forEach(child => {
    group.remove(child)
    disposeObject(child)
  })
}

function disposeObject(object: THREE.Object3D) {
  object.traverse(child => {
    const mesh = child as THREE.Mesh
    if ((mesh as any)?.isReflector && typeof (mesh as any).dispose === 'function') {
      ;(mesh as any).dispose()
    }
    if ('geometry' in mesh && mesh.geometry) {
      mesh.geometry.dispose?.()
    }
    if ('material' in mesh && mesh.material) {
      const material = mesh.material as THREE.Material | THREE.Material[]
      if (Array.isArray(material)) {
        material.forEach(mat => mat.dispose())
      } else {
        material.dispose()
      }
    }
  })
}

function createReflectorFloor(
  width: number,
  depth: number,
  options?: FactoryPresetOptions['floor']
): THREE.Group {
  const group = new THREE.Group()
  const halfW = width / 2
  const halfD = depth / 2
  const dpr = window.devicePixelRatio ?? 1
  const textureWidth = Math.max(256, Math.floor(window.innerWidth * dpr))
  const textureHeight = Math.max(256, Math.floor(window.innerHeight * dpr))
  
  // 反射地板
  const reflectorGeometry = new THREE.PlaneGeometry(width, depth)
  const reflector = new Reflector(reflectorGeometry, {
    color: 0x52c5ff,
    textureWidth,
    textureHeight,
    clipBias: 0.0005,
    multisample: 4
  })
  reflector.rotation.x = -Math.PI / 2
  reflector.receiveShadow = true
  setNonSelectable(reflector)
  group.add(reflector)
  
  // 蓝色着色层
  const floorColor = options?.color ?? 0x1e3a5f
  const tintMesh = new THREE.Mesh(
    reflectorGeometry.clone(),
    new THREE.MeshPhysicalMaterial({
      color: floorColor,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    })
  )
  tintMesh.rotation.x = -Math.PI / 2
  tintMesh.position.y = 0.0005
  tintMesh.receiveShadow = true
  setNonSelectable(tintMesh)
  group.add(tintMesh)
  
  // 添加边框（如果启用）
  if (options?.showFrame !== false) {
    addFloorBorders(group, width, depth, halfW, halfD, options?.border)
  }
  
  // 添加尺寸标注
  addDimensionLabels(group, width, depth, halfW, halfD)
  
  return group
}

function addFloorBorders(
  group: THREE.Group,
  width: number,
  depth: number,
  halfW: number,
  halfD: number,
  borderOptions?: FactoryPresetOptions['floor']['border']
) {
  const makeStrip = (w: number, d: number, x: number, z: number, material: THREE.Material) => {
    const geo = new THREE.BoxGeometry(w, 0.02, d)
    const mesh = new THREE.Mesh(geo, material)
    mesh.position.set(x, 0.02, z)
    setNonSelectable(mesh)
    return mesh
  }
  
  const innerWidth = borderOptions?.innerWidth ?? 0.35
  const outerWidth = borderOptions?.outerWidth ?? 0.9
  const innerColor = borderOptions?.innerColor ?? 0xffd45a
  const outerColor = borderOptions?.outerColor ?? 0xfff1b8
  const innerOpacity = borderOptions?.innerOpacity ?? 0.9
  const outerOpacity = borderOptions?.outerOpacity ?? 0.28
  
  // 内层边框材质
  const innerMat = new THREE.MeshBasicMaterial({
    color: innerColor,
    transparent: true,
    opacity: innerOpacity,
    depthWrite: false
  })
  
  // 外层发光边框材质
  const outerMat = new THREE.MeshBasicMaterial({
    color: outerColor,
    transparent: true,
    opacity: outerOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  
  // 内层边框
  group.add(makeStrip(width + innerWidth * 2, innerWidth, 0, -halfD, innerMat))
  group.add(makeStrip(width + innerWidth * 2, innerWidth, 0, halfD, innerMat))
  group.add(makeStrip(innerWidth, depth + innerWidth * 2, -halfW, 0, innerMat))
  group.add(makeStrip(innerWidth, depth + innerWidth * 2, halfW, 0, innerMat))
  
  // 外层发光边框
  const outerHalfW = halfW + outerWidth * 0.6
  const outerHalfD = halfD + outerWidth * 0.6
  group.add(makeStrip(width + outerWidth * 2.5, outerWidth, 0, -outerHalfD, outerMat))
  group.add(makeStrip(width + outerWidth * 2.5, outerWidth, 0, outerHalfD, outerMat))
  group.add(makeStrip(outerWidth, depth + outerWidth * 2.5, -outerHalfW, 0, outerMat))
  group.add(makeStrip(outerWidth, depth + outerWidth * 2.5, outerHalfW, 0, outerMat))
  
  // 角落装饰
  const cornerSize = 1.2
  const cornerMat = new THREE.MeshBasicMaterial({
    color: innerColor,
    transparent: true,
    opacity: 0.95
  })
  const corners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD]
  ]
  corners.forEach(([x, z]) => {
    const cornerGeo = new THREE.BoxGeometry(cornerSize, 0.03, cornerSize)
    const cornerMesh = new THREE.Mesh(cornerGeo, cornerMat)
    cornerMesh.position.set(x, 0.025, z)
    setNonSelectable(cornerMesh)
    group.add(cornerMesh)
  })
}

function addDimensionLabels(
  group: THREE.Group,
  width: number,
  depth: number,
  halfW: number,
  halfD: number
) {
  const createTextSprite = (text: string) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return null
    
    canvas.width = 512
    canvas.height = 128
    context.fillStyle = 'transparent'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    context.font = 'bold 72px Arial'
    context.fillStyle = '#ffd45a'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, canvas.width / 2, canvas.height / 2)
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(20, 5, 1)
    setNonSelectable(sprite)
    return sprite
  }
  
  // 底部宽度标注
  const widthLabel = createTextSprite(`${width}m`)
  if (widthLabel) {
    widthLabel.position.set(0, 0.5, halfD + 5)
    group.add(widthLabel)
  }
  
  // 左侧深度标注
  const depthLabel = createTextSprite(`${depth}m`)
  if (depthLabel) {
    depthLabel.position.set(-halfW - 5, 0.5, 0)
    group.add(depthLabel)
  }
}

export function setupFloor(
  ctx: CoreContext,
  options?: FactoryPresetOptions['floor']
): Pick<FactoryPresetState, 'floor' | 'floorGroup' | 'floorSize' | 'resizeFloor' | 'clampToFloor'> {
  const floorSize = {
    width: options?.width ?? 140,
    depth: options?.depth ?? 50
  }
  
  // 创建地板组
  const floorGroup = new THREE.Group()
  floorGroup.name = 'factory-floor-group'
  setNonSelectable(floorGroup)
  ctx.scene.add(floorGroup)
  
  // 构建初始地板
  const buildFloor = () => {
    clearGroup(floorGroup)
    const floor = createReflectorFloor(floorSize.width, floorSize.depth, options)
    floorGroup.add(floor)
    return floor
  }
  
  const floor = buildFloor()
  
  // 调整地板尺寸
  const resizeFloor = async (payload?: {
    deltaX?: number
    deltaZ?: number
    width?: number
    depth?: number
  }) => {
    floorSize.width = Math.max(10, payload?.width ?? floorSize.width + (payload?.deltaX ?? 0))
    floorSize.depth = Math.max(10, payload?.depth ?? floorSize.depth + (payload?.deltaZ ?? 0))
    buildFloor()
    return { width: floorSize.width, depth: floorSize.depth }
  }
  
  // 将对象限制在地板范围内
  const clampToFloor = (obj: THREE.Object3D) => {
    const halfW = floorSize.width / 2
    const halfD = floorSize.depth / 2
    obj.position.x = Math.min(Math.max(obj.position.x, -halfW), halfW)
    obj.position.z = Math.min(Math.max(obj.position.z, -halfD), halfD)
    obj.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(obj)
    if (Number.isFinite(box.min.y)) {
      obj.position.y += 0 - box.min.y
    } else if (obj.position.y < 0) {
      obj.position.y = 0
    }
    obj.updateMatrixWorld(true)
  }
  
  return {
    floor,
    floorGroup,
    floorSize,
    resizeFloor,
    clampToFloor
  }
}

