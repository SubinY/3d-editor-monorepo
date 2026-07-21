import * as THREE from 'three'
import type { AlignType, AlignmentTool } from '../editing/tools/AlignmentTool'
import type { SceneGraphManager } from '../editing/scene/SceneGraphManager'
import type { SelectionManager } from '../editing/interaction/SelectionManager'
import type { EventBus } from './EventBus'
import { EditorEvents } from './EventBus'
import type { HistoryManager, Command } from '../editing/history/HistoryManager'

interface AddOptions {
  parent?: THREE.Object3D
  select?: boolean
  description?: string
}

interface RemoveOptions {
  deselect?: boolean
  description?: string
}

/**
 * 官方“动作层”，将常用编辑操作（增删、成组、对齐）与 History / EventBus / SceneGraph 绑定，减少业务侧心智负担。
 */
export class EditorActions {
  constructor(
    private scene: THREE.Scene,
    private history: HistoryManager,
    private sceneGraph: SceneGraphManager,
    private alignment: AlignmentTool,
    private selection: SelectionManager,
    private eventBus: EventBus
  ) {}

  setScene(scene: THREE.Scene): void {
    this.scene = scene
  }

  addObject(object: THREE.Object3D, options: AddOptions = {}): void {
    const parent = options.parent ?? this.scene
    const description = options.description ?? 'add object'
    const command: Command = {
      description,
      execute: () => {
        parent.add(object)
        if (options.select !== false) {
          this.selection.select(object)
        }
        this.eventBus.emit(EditorEvents.OBJECT_ADDED, { id: object.uuid })
      },
      undo: () => {
        parent.remove(object)
        if (options.select !== false) {
          this.selection.deselect(object)
        }
        this.eventBus.emit(EditorEvents.OBJECT_REMOVED, { id: object.uuid })
      },
      redo: () => {
        parent.add(object)
        if (options.select !== false) {
          this.selection.select(object)
        }
        this.eventBus.emit(EditorEvents.OBJECT_ADDED, { id: object.uuid })
      }
    }
    this.history.execute(command)
  }

  removeObject(object: THREE.Object3D, options: RemoveOptions = {}): void {
    const parent = object.parent ?? this.scene
    const index = parent.children.indexOf(object)
    const description = options.description ?? 'remove object'
    const command: Command = {
      description,
      execute: () => {
        parent.remove(object)
        if (options.deselect !== false) {
          this.selection.deselect(object)
        }
        this.eventBus.emit(EditorEvents.OBJECT_REMOVED, { id: object.uuid })
      },
      undo: () => {
        if (index >= 0) {
          parent.children.splice(index, 0, object)
        } else {
          parent.add(object)
        }
        if (options.deselect !== false) {
          this.selection.select(object)
        }
        this.eventBus.emit(EditorEvents.OBJECT_ADDED, { id: object.uuid })
      },
      redo: () => {
        parent.remove(object)
        if (options.deselect !== false) {
          this.selection.deselect(object)
        }
        this.eventBus.emit(EditorEvents.OBJECT_REMOVED, { id: object.uuid })
      }
    }
    this.history.execute(command)
  }

  group(objects: THREE.Object3D[]): THREE.Group | null {
    if (objects.length < 2) return null
    let group: THREE.Group | null = null
    const description = 'group objects'
    const command: Command = {
      description,
      execute: () => {
        group = this.sceneGraph.group(objects)
        this.selection.clear()
        if (group) {
          this.selection.select(group)
          this.eventBus.emit(EditorEvents.OBJECT_ADDED, { id: group.uuid })
        }
      },
      undo: () => {
        if (!group) return
        const children = this.sceneGraph.ungroup(group)
        this.selection.clear()
        children.forEach(child => this.selection.select(child))
        this.eventBus.emit(EditorEvents.OBJECT_REMOVED, { id: group.uuid })
      },
      redo: () => {
        if (!group) return
        // 将当前 children 重新挂回 group 并加入场景
        group.children.forEach(child => group?.remove(child))
        objects.forEach(obj => {
          group!.attach(obj)
        })
        this.scene.add(group)
        this.selection.clear()
        this.selection.select(group)
        this.eventBus.emit(EditorEvents.OBJECT_ADDED, { id: group.uuid })
      }
    }
    this.history.execute(command)
    return group
  }

  ungroup(group: THREE.Group): THREE.Object3D[] {
    const parent = group.parent ?? this.scene
    const childrenSnapshot = [...group.children]
    const description = 'ungroup'
    let ungrouped: THREE.Object3D[] = []
    const command: Command = {
      description,
      execute: () => {
        ungrouped = this.sceneGraph.ungroup(group)
        this.selection.clear()
        ungrouped.forEach(child => this.selection.select(child))
        this.eventBus.emit(EditorEvents.OBJECT_REMOVED, { id: group.uuid })
      },
      undo: () => {
        parent.add(group)
        childrenSnapshot.forEach(child => group.attach(child))
        this.selection.clear()
        this.selection.select(group)
        this.eventBus.emit(EditorEvents.OBJECT_ADDED, { id: group.uuid })
      },
      redo: () => {
        ungrouped = this.sceneGraph.ungroup(group)
        this.selection.clear()
        ungrouped.forEach(child => this.selection.select(child))
        this.eventBus.emit(EditorEvents.OBJECT_REMOVED, { id: group.uuid })
      }
    }
    this.history.execute(command)
    return ungrouped
  }

  align(objects: THREE.Object3D[], type: AlignType): void {
    if (objects.length < 2) return
    let before: THREE.Vector3[] = []
    let after: THREE.Vector3[] = []
    const description = `align:${type}`
    const command: Command = {
      description,
      execute: () => {
        before = objects.map(obj => obj.position.clone())
        this.alignment.align(objects, type)
        after = objects.map(obj => obj.position.clone())
      },
      undo: () => {
        objects.forEach((obj, idx) => obj.position.copy(before[idx]))
      },
      redo: () => {
        objects.forEach((obj, idx) => obj.position.copy(after[idx]))
      }
    }
    this.history.execute(command)
  }
}
