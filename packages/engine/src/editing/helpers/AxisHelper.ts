import * as THREE from 'three'

export interface AxisHelperOptions {
  size?: number
  viewportSize?: number
}

export class AxisHelper {
  public worldAxis: THREE.AxesHelper
  private viewportAxis: THREE.AxesHelper
  private viewportScene: THREE.Scene
  private viewportCamera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private enabled = true

  constructor(renderer: THREE.WebGLRenderer, options: AxisHelperOptions = {}) {
    const size = options.size ?? 5
    const viewportSize = options.viewportSize ?? 80

    this.renderer = renderer
    this.worldAxis = new THREE.AxesHelper(size)

    this.viewportAxis = new THREE.AxesHelper(1.5)
    this.viewportScene = new THREE.Scene()
    this.viewportCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10)
    this.viewportCamera.position.set(2, 2, 2)
    this.viewportCamera.lookAt(0, 0, 0)
    this.viewportScene.add(this.viewportAxis)

    this.viewportAxis.renderOrder = 999

    this.renderer.domElement.style.position = 'relative'
    const overlay = document.createElement('canvas')
    overlay.width = viewportSize
    overlay.height = viewportSize
    overlay.style.position = 'absolute'
    overlay.style.right = '16px'
    overlay.style.top = '16px'
    overlay.style.pointerEvents = 'none'
    overlay.style.background = 'transparent'
    overlay.style.zIndex = '2'
    this.renderer.domElement.parentElement?.appendChild(overlay)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.worldAxis.visible = enabled
  }

  update(camera: THREE.Camera): void {
    if (!this.enabled) return
    const quaternion = new THREE.Quaternion().copy(camera.quaternion).invert()
    this.viewportAxis.quaternion.copy(quaternion)
  }
}

