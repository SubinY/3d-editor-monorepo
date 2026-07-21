import * as THREE from 'three'
import type { CameraSchema } from '../types'

export class CameraManager {
  public camera: THREE.PerspectiveCamera

  constructor(container: HTMLElement, fov = 50, near = 0.1, far = 2000) {
    const aspect = container.clientWidth / container.clientHeight || 1
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    this.camera.position.set(0, 5, 10)
  }

  updateAspect(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1)
    this.camera.updateProjectionMatrix()
  }

  serialize(): CameraSchema {
    return {
      type: 'perspective',
      fov: this.camera.fov,
      aspect: this.camera.aspect,
      near: this.camera.near,
      far: this.camera.far,
      position: this.camera.position.toArray() as [number, number, number],
      target: [0, 0, 0]
    }
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera
  }
}
