import * as THREE from 'three'

const HELPER_TYPES = new Set([
  'AxesHelper',
  'GridHelper',
  'TransformControls',
  'TransformControlsPlane',
  'TransformControlsGizmo',
  'BoxHelper',
  'ArrowHelper',
  'Line',
  'LineSegments',
  'LineSegments2',
  'Sprite'
])

/**
 * 统一管理“哪些对象可选/可序列化”的规则，避免 Selection 与 Serializer 分散维护。
 */
export const EditorObjectPolicy = {
  isHelper(object: THREE.Object3D): boolean {
    if (HELPER_TYPES.has(object.type)) return true
    if (object.name === 'AxisHelper') return true
    if (object.name === '__selectionHighlight__') return true
    if (object.name?.startsWith('__')) return true
    if (object.userData?.nonSelectable) return true
    return false
  },

  isSelectable(object: THREE.Object3D): boolean {
    if (this.isHelper(object)) return false
    // 仅 Mesh / Group 可选，其余对象（如灯光）默认不可选
    return object.type === 'Mesh' || object.type === 'Group'
  },

  isSerializable(object: THREE.Object3D): boolean {
    // 可序列化对象需要同时满足：不是辅助对象、不是 TransformControls、高亮等
    if (this.isHelper(object)) return false
    // 场景中灯光单独序列化，这里只保留 mesh/group
    if ((object as THREE.Light).isLight) return false
    return object.type === 'Mesh' || object.type === 'Group'
  }
}

