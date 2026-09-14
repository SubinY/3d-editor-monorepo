import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { fitObjectToFootprint } from '../fit-to-footprint'

describe('fitObjectToFootprint', () => {
  it('均匀装进 footprint，底面贴 y=0', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
    mesh.position.y = 1
    fitObjectToFootprint(mesh, { width: 1, depth: 1, height: 1 })
    mesh.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(mesh)
    expect(box.min.y).toBeCloseTo(0)
    expect(box.max.x - box.min.x).toBeCloseTo(1)
    expect(box.max.y - box.min.y).toBeCloseTo(1)
    expect(box.max.z - box.min.z).toBeCloseTo(1)
  })
})
