import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createInfiniteGrid } from '../infinite-grid'

describe('createInfiniteGrid', () => {
  it('单 mesh、ShaderMaterial、不参与视锥裁剪', () => {
    const grid = createInfiniteGrid()
    expect(grid.isMesh).toBe(true)
    expect(grid.frustumCulled).toBe(false)
    expect(grid.material).toBeInstanceOf(THREE.ShaderMaterial)
    const uniforms = (grid.material as THREE.ShaderMaterial).uniforms
    expect(uniforms.uSize1.value).toBe(1)
    expect(uniforms.uSize2.value).toBe(10)
    grid.geometry.dispose()
    ;(grid.material as THREE.Material).dispose()
  })
})
