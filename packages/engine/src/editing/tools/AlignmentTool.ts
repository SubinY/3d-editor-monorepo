import * as THREE from 'three'

export type AlignType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'distribute-h'
  | 'distribute-v'

export class AlignmentTool {
  align(objects: THREE.Object3D[], type: AlignType): void {
    if (objects.length === 0) return
    const box = new THREE.Box3()
    const bounds = objects.reduce((acc, obj) => acc.union(box.setFromObject(obj)), new THREE.Box3())

    switch (type) {
      case 'left':
        objects.forEach(obj => (obj.position.x += bounds.min.x - this.getBox(obj).min.x))
        break
      case 'center': {
        const center = (bounds.max.x + bounds.min.x) / 2
        objects.forEach(obj => {
          const objectBox = this.getBox(obj)
          const objCenter = (objectBox.max.x + objectBox.min.x) / 2
          obj.position.x += center - objCenter
        })
        break
      }
      case 'right':
        objects.forEach(obj => (obj.position.x += bounds.max.x - this.getBox(obj).max.x))
        break
      case 'top':
        objects.forEach(obj => (obj.position.z += bounds.max.z - this.getBox(obj).max.z))
        break
      case 'middle': {
        const centerZ = (bounds.max.z + bounds.min.z) / 2
        objects.forEach(obj => {
          const objectBox = this.getBox(obj)
          const objCenter = (objectBox.max.z + objectBox.min.z) / 2
          obj.position.z += centerZ - objCenter
        })
        break
      }
      case 'bottom':
        objects.forEach(obj => (obj.position.z += bounds.min.z - this.getBox(obj).min.z))
        break
      case 'distribute-h':
        this.distribute(objects, 'x')
        break
      case 'distribute-v':
        this.distribute(objects, 'z')
        break
    }
  }

  private distribute(objects: THREE.Object3D[], axis: 'x' | 'z'): void {
    if (objects.length < 3) return
    const sorted = [...objects].sort((a, b) => a.position[axis] - b.position[axis])
    const start = sorted[0].position[axis]
    const end = sorted[sorted.length - 1].position[axis]
    const step = (end - start) / (sorted.length - 1)
    sorted.slice(1, -1).forEach((obj, index) => {
      obj.position[axis] = start + step * (index + 1)
    })
  }

  private getBox(object: THREE.Object3D): THREE.Box3 {
    return new THREE.Box3().setFromObject(object)
  }
}

