export type DrawShape = 'polyline' | 'polygon' | 'spline'

export interface DrawPoint {
  x: number
  y: number
  z: number
}

export interface DrawPath {
  id: string
  shape: DrawShape
  points: DrawPoint[]
}

export class DrawingManager {
  private paths: Map<string, DrawPath> = new Map()

  createPath(shape: DrawShape, points: DrawPoint[]): DrawPath {
    const id = `path-${Date.now()}-${this.paths.size}`
    const path = { id, shape, points }
    this.paths.set(id, path)
    return path
  }

  removePath(id: string): void {
    this.paths.delete(id)
  }

  list(): DrawPath[] {
    return Array.from(this.paths.values())
  }
}
