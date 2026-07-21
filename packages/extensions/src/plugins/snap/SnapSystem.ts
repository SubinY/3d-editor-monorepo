import * as THREE from 'three'

export interface SnapOptions {
  enabled?: boolean
  gridSize?: number
  angleStep?: number
}

export class SnapSystem {
  private options: Required<SnapOptions>

  constructor(options: SnapOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      gridSize: options.gridSize ?? 1,
      angleStep: options.angleStep ?? THREE.MathUtils.degToRad(15)
    }
  }

  updateOptions(options: SnapOptions): void {
    this.options = { ...this.options, ...options }
  }

  snapPosition(position: THREE.Vector3): THREE.Vector3 {
    if (!this.options.enabled) return position
    const snapped = position.clone()
    snapped.x = Math.round(snapped.x / this.options.gridSize) * this.options.gridSize
    snapped.y = Math.round(snapped.y / this.options.gridSize) * this.options.gridSize
    snapped.z = Math.round(snapped.z / this.options.gridSize) * this.options.gridSize
    return snapped
  }

  snapRotation(rotation: THREE.Euler): THREE.Euler {
    if (!this.options.enabled) return rotation
    const snapped = rotation.clone()
    snapped.x = this.snapAngle(snapped.x)
    snapped.y = this.snapAngle(snapped.y)
    snapped.z = this.snapAngle(snapped.z)
    return snapped
  }

  private snapAngle(value: number): number {
    return Math.round(value / this.options.angleStep) * this.options.angleStep
  }
}


