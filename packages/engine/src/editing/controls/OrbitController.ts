import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type * as THREE from 'three'
import type { ControlAdapter } from './ControlAdapter'

export class OrbitController implements ControlAdapter {
  public controls: OrbitControls
  public readonly type = 'orbit'

  constructor(camera: THREE.Camera, dom: HTMLElement) {
    this.controls = new OrbitControls(camera, dom)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
  }

  update(): void {
    this.controls.update()
  }

  setEnabled(enabled: boolean): void {
    this.controls.enabled = enabled
  }

  getCamera(): THREE.Camera {
    return this.controls.object
  }

  dispose(): void {
    this.controls.dispose()
  }
}
