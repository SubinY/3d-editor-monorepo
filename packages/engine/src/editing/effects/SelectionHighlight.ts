import * as THREE from 'three'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'

export interface SelectionHighlightOptions {
  color?: THREE.ColorRepresentation
  thickness?: number
  pulsate?: boolean
}

/**
 * 选中对象的高亮描边效果
 * 使用 Line2 实现真正的加粗描边
 */
export class SelectionHighlight {
  private highlightedObjects = new Map<THREE.Object3D, LineSegments2>()
  private renderer: THREE.WebGLRenderer
  private color: THREE.Color
  private thickness: number
  private pulsate: boolean
  private pulsateTime = 0

  constructor(
    _scene: THREE.Scene,
    _camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    options: SelectionHighlightOptions = {}
  ) {
    this.renderer = renderer
    this.color = new THREE.Color(options.color ?? 'blue') // 蓝色描边
    this.thickness = options.thickness ?? 5 // 线条粗细（像素）
    this.pulsate = options.pulsate ?? true
  }

  /**
   * 为对象添加高亮效果
   */
  add(object: THREE.Object3D): void {
    if (!this.isHighlightable(object) || this.highlightedObjects.has(object)) return

    // 只对 Mesh 添加边缘线
    if (object instanceof THREE.Mesh && object.geometry) {
      const edges = new THREE.EdgesGeometry(object.geometry, 1)
      
      // 将 EdgesGeometry 转换为 LineSegmentsGeometry
      const positions = edges.attributes.position.array
      const lineSegmentsGeometry = new LineSegmentsGeometry()
      lineSegmentsGeometry.setPositions(Array.from(positions as ArrayLike<number>) as number[])
      
      // 获取渲染器尺寸用于计算线宽
      const size = new THREE.Vector2()
      this.renderer.getSize(size)
      
      // 使用 LineMaterial 实现真正的加粗效果
      const lineMaterial = new LineMaterial({
        color: this.color.getHex(),
        linewidth: this.thickness, // 以像素为单位
        resolution: size, // 渲染器分辨率
        transparent: true,
        opacity: 0.9,
        depthTest: true,
        depthWrite: false
      })
      
      const line = new LineSegments2(lineSegmentsGeometry, lineMaterial)
      
      // 边缘线作为子对象，自动跟随父对象变换
      line.renderOrder = 999
      line.name = '__selectionHighlight__'
      line.userData.nonSelectable = true
      
      // 禁用描边的 raycast，避免阻挡拾取
      line.raycast = () => {}
      
      object.add(line)
      this.highlightedObjects.set(object, line)
    }
  }

  /**
   * 移除对象的高亮效果
   */
  remove(object: THREE.Object3D): void {
    const line = this.highlightedObjects.get(object)
    if (!line) return

    object.remove(line)
    line.geometry.dispose()
    if (line.material instanceof THREE.Material) {
      line.material.dispose()
    }
    this.highlightedObjects.delete(object)
  }

  /**
   * 清除所有高亮
   */
  clear(): void {
    this.highlightedObjects.forEach((_line, object) => {
      this.remove(object)
    })
  }

  /**
   * 更新高亮对象列表
   */
  setHighlightedObjects(objects: THREE.Object3D[]): void {
    // 移除不在新列表中的对象
    const objectSet = new Set(objects.filter(obj => this.isHighlightable(obj)))
    this.highlightedObjects.forEach((_line, obj) => {
      if (!objectSet.has(obj)) {
        this.remove(obj)
      }
    })

    // 添加新对象
    objectSet.forEach(obj => this.add(obj))
  }

  /**
   * 更新动画效果（脉动）
   */
  update(delta: number): void {
    if (!this.pulsate || this.highlightedObjects.size === 0) return

    this.pulsateTime += delta
    const opacity = 0.7 + Math.sin(this.pulsateTime * 3) * 0.2

    this.highlightedObjects.forEach(line => {
      if (line.material instanceof LineMaterial) {
        line.material.opacity = opacity
      }
    })
  }

  /**
   * 设置高亮颜色
   */
  setColor(color: THREE.ColorRepresentation): void {
    this.color.set(color)
    this.highlightedObjects.forEach(line => {
      if (line.material instanceof LineMaterial) {
        line.material.color.set(this.color.getHex())
      }
    })
  }

  /**
   * 更新渲染器大小（用于 LineMaterial 的分辨率）
   */
  setSize(width: number, height: number): void {
    const resolution = new THREE.Vector2(width, height)
    this.highlightedObjects.forEach(line => {
      if (line.material instanceof LineMaterial) {
        line.material.resolution = resolution
      }
    })
  }

  /**
   * 更新场景（兼容性保留）
   */
  setScene(_scene: THREE.Scene): void {
    // EdgesGeometry 不需要更新场景
  }

  /**
   * 更新相机（兼容性保留）
   */
  setCamera(_camera: THREE.Camera): void {
    // EdgesGeometry 不需要更新相机
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.clear()
  }

  private isHighlightable(object: THREE.Object3D): boolean {
    // 排除常见的辅助对象
    const helperTypes = new Set([
      'AxesHelper',
      'GridHelper',
      'TransformControls',
      'TransformControlsPlane',
      'TransformControlsGizmo',
      'BoxHelper',
      'Line',
      'LineSegments'
    ])
    if (helperTypes.has(object.type)) return false
    if (object.name === '__selectionHighlight__') return false
    if (object.userData?.nonSelectable) return false
    return object instanceof THREE.Mesh
  }
}