import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  applyTransformWithPivot,
  bakePivotTranslation,
  getFootprintPivot,
  mountFootprintPivot,
  readTransformFromPivot
} from '../footprint-pivot'

describe('footprint-pivot', () => {
  it('content 下移半高后世界底面仍在根原点', () => {
    const root = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1))
    mesh.position.y = 1
    mountFootprintPivot(THREE, root, mesh, 2)
    root.updateMatrixWorld(true)
    const world = new THREE.Vector3()
    mesh.getWorldPosition(world)
    expect(world.y).toBeCloseTo(1)
    const pivot = getFootprintPivot(root)
    expect(pivot?.position.y).toBeCloseTo(1)
  })

  it('bake 把枢轴平移折进根 position', () => {
    const root = new THREE.Group()
    root.position.set(3, 0, 4)
    const content = new THREE.Group()
    const pivot = mountFootprintPivot(THREE, root, content, 2)
    pivot.position.set(0.5, 1.2, -0.3)
    bakePivotTranslation(root)
    expect(root.position.x).toBeCloseTo(3.5)
    expect(root.position.y).toBeCloseTo(0.2)
    expect(root.position.z).toBeCloseTo(3.7)
    expect(pivot.position.x).toBeCloseTo(0)
    expect(pivot.position.y).toBeCloseTo(1)
    expect(pivot.position.z).toBeCloseTo(0)
  })

  it('apply/read：position 在根，rotation/scale 在枢轴', () => {
    const root = new THREE.Group()
    mountFootprintPivot(THREE, root, new THREE.Group(), 0.4)
    applyTransformWithPivot(root, {
      position: [1, 0.1, -2],
      rotation: [0, 0.2, 0.5],
      scale: [1, 1, 1]
    })
    const next = readTransformFromPivot(root)
    expect(next.position).toEqual([1, 0.1, -2])
    expect(next.rotation[2]).toBeCloseTo(0.5)
    expect(root.rotation.z).toBeCloseTo(0)
  })
})
