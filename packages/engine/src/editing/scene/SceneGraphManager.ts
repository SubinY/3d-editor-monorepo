import * as THREE from 'three'

export class SceneGraphManager {
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene
  }

  group(objects: THREE.Object3D[]): THREE.Group {
    const group = new THREE.Group()
    group.name = `Group_${Date.now()}`
    // 标记为编辑器创建的组
    group.userData.isEditorGroup = true
    
    // 计算所有对象的中心位置（世界坐标）
    const center = new THREE.Vector3()
    objects.forEach(obj => {
      const worldPos = new THREE.Vector3()
      obj.getWorldPosition(worldPos)
      center.add(worldPos)
    })
    center.divideScalar(objects.length)
    
    // 将 Group 放置在中心位置
    group.position.copy(center)
    this.scene.add(group)
    
    // 使用 attach() 方法将对象添加到 Group，保持世界坐标不变
    objects.forEach(obj => {
      group.attach(obj)
    })
    
    return group
  }

  ungroup(group: THREE.Group): THREE.Object3D[] {
    const children = [...group.children]
    children.forEach(child => this.scene.add(child))
    group.parent?.remove(group)
    return children
  }

  setParent(child: THREE.Object3D, parent: THREE.Object3D | THREE.Scene): void {
    parent.add(child)
  }

  setVisible(object: THREE.Object3D, visible: boolean): void {
    object.visible = visible
  }

  setLocked(object: THREE.Object3D, locked: boolean): void {
    object.userData.__locked = locked
  }

  isLocked(object: THREE.Object3D): boolean {
    return object.userData.__locked === true
  }

  /**
   * 判断对象是否是编辑器创建的组
   */
  isGroup(object: THREE.Object3D): boolean {
    return object.type === 'Group' && object.userData.isEditorGroup === true
  }

  /**
   * 查找对象所属的最顶层编辑器组（如果有）
   */
  findParentGroup(object: THREE.Object3D): THREE.Group | null {
    let current = object.parent
    while (current && current.type !== 'Scene') {
      if (this.isGroup(current)) {
        return current as THREE.Group
      }
      current = current.parent
    }
    return null
  }
}
