import * as THREE from 'three'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { isObjectUnder } from '../utils/node-path'

export interface HoverHighlightOptions {
  color?: THREE.ColorRepresentation
  thickness?: number
}

/**
 * 悬停描边：EdgesGeometry + Line2（非 EffectComposer / OutlinePass）。
 * 作用于 path 根下的 mesh，跳过嵌套 path 子树。
 */
export class HoverHighlight {
  private lines = new Map<THREE.Mesh, LineSegments2>()
  private color: THREE.Color
  private thickness: number
  private resolution = new THREE.Vector2(1, 1)
  private currentRoot: THREE.Object3D | null = null

  constructor(
    private renderer: THREE.WebGLRenderer,
    options: HoverHighlightOptions = {}
  ) {
    this.color = new THREE.Color(options.color ?? '#39d2ff')
    this.thickness = options.thickness ?? 2.5
    this.syncResolution()
  }

  /** 高亮 path 根；nestedRoots 为该 path 下嵌套子 path 的根（不进入） */
  setTarget(root: THREE.Object3D | null, nestedRoots: THREE.Object3D[] = []): void {
    if (root === this.currentRoot) return
    this.clear()
    this.currentRoot = root
    if (!root) return

    root.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      if (mesh.userData.nonSelectable) return
      if (mesh.name.startsWith('__')) return
      if (nestedRoots.some(nr => isObjectUnder(mesh, nr))) return
      this.addMesh(mesh)
    })
  }

  clear(): void {
    this.lines.forEach((line, mesh) => {
      mesh.remove(line)
      line.geometry.dispose()
      ;(line.material as LineMaterial).dispose()
    })
    this.lines.clear()
    this.currentRoot = null
  }

  setSize(width: number, height: number): void {
    this.resolution.set(width, height)
    this.lines.forEach(line => {
      ;(line.material as LineMaterial).resolution.copy(this.resolution)
    })
  }

  dispose(): void {
    this.clear()
  }

  private syncResolution(): void {
    const size = new THREE.Vector2()
    this.renderer.getSize(size)
    this.resolution.copy(size)
  }

  private addMesh(mesh: THREE.Mesh): void {
    if (this.lines.has(mesh)) return
    const edges = new THREE.EdgesGeometry(mesh.geometry, 20)
    const positions = edges.attributes.position?.array
    if (!positions || positions.length === 0) {
      edges.dispose()
      return
    }
    const geo = new LineSegmentsGeometry()
    geo.setPositions(Array.from(positions as ArrayLike<number>) as number[])
    edges.dispose()

    const mat = new LineMaterial({
      color: this.color.getHex(),
      linewidth: this.thickness,
      resolution: this.resolution.clone(),
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false
    })
    const line = new LineSegments2(geo, mat)
    line.renderOrder = 998
    line.name = '__hoverOutline__'
    line.userData.nonSelectable = true
    line.raycast = () => {}
    mesh.add(line)
    this.lines.set(mesh, line)
  }
}
