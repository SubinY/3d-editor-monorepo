import * as THREE from 'three'
import type { RendererOptionsSchema } from '../types'

export type RendererOptions = RendererOptionsSchema

export class Renderer {
  public renderer: THREE.WebGLRenderer

  constructor(container: HTMLElement, options: RendererOptions = {}) {
    const { antialias = true, alpha = true, logarithmicDepthBuffer = true, pixelRatio = window.devicePixelRatio } =
      options

    this.renderer = new THREE.WebGLRenderer({ antialias, alpha, logarithmicDepthBuffer })
    this.renderer.setPixelRatio(pixelRatio || window.devicePixelRatio)
    this.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera)
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height)
  }

  dispose(): void {
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
