import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { disposeMaterial, disposeObject3D } from '../dispose'

describe('disposeMaterial', () => {
  it('释放材质引用的贴图后再 dispose 材质', () => {
    const map = new THREE.Texture()
    const normalMap = new THREE.Texture()
    const mapDispose = vi.spyOn(map, 'dispose')
    const normalDispose = vi.spyOn(normalMap, 'dispose')
    const mat = new THREE.MeshStandardMaterial({ map, normalMap })
    const matDispose = vi.spyOn(mat, 'dispose')

    disposeMaterial(mat)

    expect(mapDispose).toHaveBeenCalledOnce()
    expect(normalDispose).toHaveBeenCalledOnce()
    expect(matDispose).toHaveBeenCalledOnce()
  })

  it('无贴图材质只 dispose 自身', () => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const matDispose = vi.spyOn(mat, 'dispose')
    disposeMaterial(mat)
    expect(matDispose).toHaveBeenCalledOnce()
  })
})

describe('disposeObject3D', () => {
  it('释放灯光 shadow.map（网格开关会整份重建灯光，不释放就会贴图计数单调涨）', () => {
    const light = new THREE.DirectionalLight()
    const map = { dispose: vi.fn() } as unknown as THREE.WebGLRenderTarget
    light.shadow.map = map

    disposeObject3D(light)

    expect(map.dispose).toHaveBeenCalledOnce()
    expect(light.shadow.map).toBeNull()
  })

  it('释放 Line/GridHelper 的 geometry 与材质', () => {
    const grid = new THREE.GridHelper(10, 10)
    const geo = grid.geometry
    const geoDispose = vi.spyOn(geo, 'dispose')
    const mat = grid.material as THREE.Material
    const matDispose = vi.spyOn(mat, 'dispose')

    disposeObject3D(grid)

    expect(geoDispose).toHaveBeenCalledOnce()
    expect(matDispose).toHaveBeenCalledOnce()
  })

  it('遍历子树释放 geometry 与材质贴图', () => {
    const root = new THREE.Group()
    const map = new THREE.Texture()
    const mapDispose = vi.spyOn(map, 'dispose')
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const geoDispose = vi.spyOn(geo, 'dispose')
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map }))
    root.add(mesh)

    disposeObject3D(root)

    expect(geoDispose).toHaveBeenCalledOnce()
    expect(mapDispose).toHaveBeenCalledOnce()
  })
})
