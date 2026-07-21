import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import type { ControlMode } from '../../types'

export class TransformController {
  public controls: TransformControls
  private attachedObject: THREE.Object3D | null = null
  private multiSelectionGroup: THREE.Group | null = null
  private originalParents = new Map<THREE.Object3D, THREE.Object3D | null>()
  private currentMode: ControlMode = 'translate'

  constructor(camera: THREE.Camera, dom: HTMLElement) {
    this.controls = new TransformControls(camera, dom)
    this.controls.setMode('translate')
    // 移除有问题的事件监听器，交给外部处理
  }

  setMode(mode: ControlMode): void {
    this.currentMode = mode
    this.controls.setMode(mode)
  }

  getMode(): ControlMode {
    return this.currentMode
  }

  attach(object: THREE.Object3D | null): void {
    // 防止重复附加同一个对象
    if (object === this.attachedObject) return
    
    if (object) {
      // 确保不会附加到 TransformControls 自身或其子对象
      if (object === this.controls || this.isChildOfControls(object)) {
        console.warn('Cannot attach TransformControls to itself or its children')
        return
      }
      
      // 先detach之前的对象
      this.detachInternal()
      
      this.controls.attach(object)
      this.attachedObject = object
      
      // 恢复之前的模式
      this.controls.setMode(this.currentMode)
    } else {
      this.detachInternal()
    }
  }

  /**
   * 附加多个对象（通过创建临时Group）
   */
  attachMultiple(objects: THREE.Object3D[]): void {
    if (objects.length === 0) {
      this.detachInternal()
      return
    }

    if (objects.length === 1) {
      this.attach(objects[0])
      return
    }

    // 检查是否已经附加了相同的对象集合，避免重复创建
    if (this.multiSelectionGroup && this.multiSelectionGroup.children.length === objects.length) {
      const currentChildren = new Set(this.multiSelectionGroup.children)
      const allSame = objects.every(obj => currentChildren.has(obj))
      if (allSame) {
        // 已经附加了相同的对象，不需要重新创建
        return
      }
    }

    // 先detach之前的对象
    this.detachInternal()

    // 创建临时Group
    this.multiSelectionGroup = new THREE.Group()
    
    // 保存第一个对象的父级（在移除之前）
    const targetParent = objects[0].parent
    
    // 计算所有对象的中心点
    const center = new THREE.Vector3()
    objects.forEach(obj => {
      const worldPos = new THREE.Vector3()
      obj.getWorldPosition(worldPos)
      center.add(worldPos)
    })
    center.divideScalar(objects.length)

    this.multiSelectionGroup.position.copy(center)

    // 将所有对象添加到Group（保存原始父级）
    objects.forEach(obj => {
      this.originalParents.set(obj, obj.parent)
      
      // 保持世界坐标不变
      const worldPos = new THREE.Vector3()
      const worldRot = new THREE.Quaternion()
      const worldScale = new THREE.Vector3()
      obj.getWorldPosition(worldPos)
      obj.getWorldQuaternion(worldRot)
      obj.getWorldScale(worldScale)

      if (obj.parent) {
        obj.parent.remove(obj)
      }
      
      if (this.multiSelectionGroup) {
        this.multiSelectionGroup.add(obj)
        
        // 恢复世界坐标
        obj.position.copy(worldPos)
        obj.quaternion.copy(worldRot)
        obj.scale.copy(worldScale)
        this.multiSelectionGroup.worldToLocal(obj.position)
      }
    })

    // 将Group添加到场景（使用之前保存的父级）
    if (targetParent) {
      targetParent.add(this.multiSelectionGroup)
    }
    
    this.controls.attach(this.multiSelectionGroup)
    this.attachedObject = this.multiSelectionGroup
    
    // 恢复之前的模式
    this.controls.setMode(this.currentMode)
  }

  /**
   * 应用Group的变换到所有子对象并解散Group
   */
  private dissolveMultiSelectionGroup(): void {
    if (!this.multiSelectionGroup) return

    const children = [...this.multiSelectionGroup.children]
    
    children.forEach(obj => {
      const worldPos = new THREE.Vector3()
      const worldRot = new THREE.Quaternion()
      const worldScale = new THREE.Vector3()
      obj.getWorldPosition(worldPos)
      obj.getWorldQuaternion(worldRot)
      obj.getWorldScale(worldScale)

      this.multiSelectionGroup!.remove(obj)
      
      const originalParent = this.originalParents.get(obj)
      if (originalParent && originalParent.type !== 'Scene') {
        originalParent.add(obj)
      } else if (this.multiSelectionGroup!.parent) {
        this.multiSelectionGroup!.parent.add(obj)
      }
      
      obj.position.copy(worldPos)
      obj.quaternion.copy(worldRot)
      obj.scale.copy(worldScale)
      
      if (obj.parent) {
        obj.parent.worldToLocal(obj.position)
      }
    })

    if (this.multiSelectionGroup.parent) {
      this.multiSelectionGroup.parent.remove(this.multiSelectionGroup)
    }
    
    this.multiSelectionGroup = null
    this.originalParents.clear()
  }

  private detachInternal(): void {
    if (this.multiSelectionGroup) {
      this.dissolveMultiSelectionGroup()
    }
    
    this.controls.detach()
    this.attachedObject = null
  }

  private isChildOfControls(object: THREE.Object3D): boolean {
    let current = object.parent
    while (current) {
      if (current === this.controls) return true
      current = current.parent
    }
    return false
  }

  /**
   * 获取当前附加的对象
   */
  getAttachedObject(): THREE.Object3D | null {
    return this.attachedObject
  }

  /**
   * 获取是否处于多选模式
   */
  isMultiSelection(): boolean {
    return this.multiSelectionGroup !== null
  }

  dispose(): void {
    this.detachInternal()
    this.controls.dispose()
  }
}
