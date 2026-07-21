import * as THREE from "three"
import { EventBus, EditorEvents } from "../../runtime/EventBus"
import { EditorObjectPolicy } from "../../policies/EditorObjectPolicy"

export interface SelectionResult {
  object: THREE.Object3D | null
  point?: THREE.Vector3
}

export class SelectionManager {
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private camera: THREE.Camera
  private selectedObjects = new Set<THREE.Object3D>()
  private sceneGraphManager?: any
  private eventBus?: EventBus
  public onSelectionChanged?: (selection: THREE.Object3D[]) => void

  constructor(camera: THREE.Camera, eventBus?: EventBus) {
    this.camera = camera
    this.eventBus = eventBus
  }

  setSceneGraphManager(manager: any): void {
    this.sceneGraphManager = manager
  }

  pick(clientX: number, clientY: number, dom: HTMLElement, objects: THREE.Object3D[]): SelectionResult {
    const { width, height, left, top } = dom.getBoundingClientRect()
    this.pointer.x = ((clientX - left) / width) * 2 - 1
    this.pointer.y = -((clientY - top) / height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(objects, true)

    const validHit = hits.find(hit => EditorObjectPolicy.isSelectable(hit.object))
    if (!validHit) return { object: null }

    let targetObject = validHit.object
    if (this.sceneGraphManager) {
      const parentGroup = this.sceneGraphManager.findParentGroup(targetObject)
      if (parentGroup) {
        targetObject = parentGroup
      }
    }

    return { object: targetObject, point: validHit.point }
  }

  select(object: THREE.Object3D, additive = false): void {
    if (!additive) {
      this.clear()
    }
    this.selectedObjects.add(object)
    this.notifyChanged()
  }

  deselect(object: THREE.Object3D): void {
    this.selectedObjects.delete(object)
    this.notifyChanged()
  }

  clear(): void {
    this.selectedObjects.clear()
    this.notifyChanged()
  }

  getSelection(): THREE.Object3D[] {
    return Array.from(this.selectedObjects)
  }

  getSelectionIds(): string[] {
    return Array.from(this.selectedObjects).map(obj => obj.uuid)
  }

  getSelectionCount(): number {
    return this.selectedObjects.size
  }

  isSelected(object: THREE.Object3D): boolean {
    return this.selectedObjects.has(object)
  }

  toggle(object: THREE.Object3D): void {
    if (this.isSelected(object)) {
      this.deselect(object)
    } else {
      this.select(object, true)
    }
  }

  private notifyChanged(): void {
    const selection = this.getSelection()
    this.eventBus?.emit(EditorEvents.OBJECT_SELECTED, {
      ids: this.getSelectionIds(),
      objects: selection
    })
    this.onSelectionChanged?.(selection)
  }
}
