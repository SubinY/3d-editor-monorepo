# TransformControls 死循环问题修复

## 问题描述

```
Uncaught RangeError: Maximum call stack size exceeded
at TransformControls.updateMatrixWorld
```

鼠标移动场景一段时间后，TransformControls 会进入无限递归的 `updateMatrixWorld` 调用。

## 问题根本原因

### 1. 混淆了"选择"和"模式切换"两个操作

- **选择操作**(`selectObject`):选中某个mesh时应该调用 `attach(object)`
- **模式切换**(`setTool`):切换 translate/rotate/scale 时只应该调用 `setMode()`,不应该调用 `attach()`

原代码错误地在 `setTool` 中每次都调用 `attach()`,导致:
- 即使已经附加了对象,切换模式时又重复附加
- 增加了不必要的操作和潜在风险

### 2. TransformControls 被选中自己

- 用户可能点击到 TransformControls 的 Gizmo 部分
- 导致 `attach(controls)` 被调用
- TransformControls 成为自己的子对象,形成循环引用

## 修复方案

### 核心原则:分离"选择"和"模式切换"

#### ✅ 正确的设计
- **选择操作** → 调用 `attach(object)` 
- **模式切换** → 仅调用 `setMode(mode)`,不要调用 `attach()`

#### ❌ 错误的设计
```typescript
// 错误示例:在setTool中重复attach
const setTool = (mode: ControlMode) => {
  ctx.value.transform.setMode(mode)
  if (selectedObjectId.value) {
    const obj = ctx.value.scene.getObjectByProperty('uuid', selectedObjectId.value)
    ctx.value.transform.attach(obj || null)  // ❌ 不应该在这里attach
  }
}
```

### 1. Editor.vue 修复模式切换逻辑

```typescript
// apps/demo-vue3/src/views/Editor.vue
const setTool = (mode: ControlMode | 'select') => {
  currentTool.value = mode
  if (!ctx.value) return
  
  // ✅ 只切换模式,不重新attach
  // attach操作只应该在选择对象时执行
  if (mode !== 'select') {
    ctx.value.transform.setMode(mode)
  }
  
  ctx.value.eventBus.emit(EditorEvents.TOOL_CHANGED, { mode })
}

// 选择对象时才调用attach
const selectObject = (id: string | null) => {
  selectedObjectId.value = id
  if (!ctx.value) return
  
  if (id) {
    const obj = ctx.value.scene.getObjectByProperty('uuid', id)
    if (obj) {
       ctx.value.selection.select(obj)
       ctx.value.transform.attach(obj)  // ✅ 在选择时attach
       updateTrigger.value++
       ctx.value.eventBus.emit(EditorEvents.OBJECT_SELECTED, { id })
    }
  } else {
    ctx.value.selection.clear()
    ctx.value.transform.attach(null)
    ctx.value.eventBus.emit(EditorEvents.OBJECT_SELECTED, { id: null })
  }
}
```

### 2. TransformController 内部防护

```typescript
// packages/engine/src/controls/TransformController.ts
export class TransformController {
  private attachedObject: THREE.Object3D | null = null

  attach(object: THREE.Object3D | null): void {
    // 防止重复附加同一个对象
    if (object === this.attachedObject) return
    
    if (object) {
      // 确保不会附加到 TransformControls 自身或其子对象
      if (object === this.controls || this.isChildOfControls(object)) {
        console.warn('Cannot attach TransformControls to itself or its children')
        return
      }
      this.controls.attach(object)
      this.attachedObject = object
    } else {
      this.controls.detach()
      this.attachedObject = null
    }
  }

  private isChildOfControls(object: THREE.Object3D): boolean {
    let current = object.parent
    while (current) {
      if (current === this.controls) return true
      current = current.parent
    }
    return false
  }
}
```

### 3. Editor.vue 点击过滤

```typescript
// apps/demo-vue3/src/views/Editor.vue
const handlePointerDown = (event: PointerEvent) => {
  if (!ctx.value || currentTool.value !== 'select') return
  
  const result = ctx.value.selection.pick(...)
  if (result.object) {
    // 过滤掉辅助对象和 TransformControls
    if (result.object.type === 'GridHelper' || 
        result.object.type === 'AxesHelper' || 
        result.object.type === 'TransformControls' ||
        result.object.parent?.type === 'TransformControlsPlane' ||
        result.object.parent?.type === 'TransformControlsGizmo') return
    
    // 选中并attach
    const target = findSelectableRoot(result.object)
    ctx.value.selection.select(target, event.shiftKey)
    selectObject(target.uuid)
  }
}
```

## 防护层级

1. **第一层：职责分离** - `setTool` 只切换模式,`selectObject` 才调用 attach
2. **第二层：外部过滤** - 在点击检测时过滤掉 TransformControls
3. **第三层：内部检查** - `attach()` 方法检查对象合法性
4. **第四层：重复检测** - 避免重复附加同一对象

## 验证步骤

1. 启动编辑器
2. 添加多个对象
3. 频繁切换选中不同对象
4. 移动相机和场景
5. 点击 Gizmo 的各个部分
6. 长时间操作（5-10 分钟）

**预期结果**：不应该出现 `Maximum call stack size exceeded` 错误。

## 相关 TransformControls 类型

- `TransformControls` - 主控制器
- `TransformControlsGizmo` - Gizmo 显示部分
- `TransformControlsPlane` - 拖拽平面

这些类型的对象都不应该被选中或附加到 TransformControls。

## 设计原则总结

### 关键点
1. **attach() 只在选择对象时调用** - 选中mesh/取消选择时
2. **setMode() 只在切换模式时调用** - translate/rotate/scale切换时
3. **不要混淆这两个操作** - 它们是独立的职责

### 反模式
❌ 在工具切换时重新attach已选中的对象
❌ 在每次点击时都attach,即使是同一个对象(已有防护,但不应该走到这里)
❌ 允许选中TransformControls自身或其子对象

### 其他注意事项
- **不要在 TransformController 构造函数中添加事件监听器**
- **不要禁用 TransformControls 的 matrixAutoUpdate**
- **确保 TransformControls 只添加到场景一次**
- **在 dispose 时清理 attachedObject 引用**

## 测试清单

- [ ] 添加对象后移动相机不报错
- [ ] 点击对象切换选中不报错
- [ ] 点击 Gizmo 不会选中 Gizmo
- [ ] **切换translate/rotate/scale模式不会重新attach对象**
- [ ] 快速连续点击不同对象不报错
- [ ] **频繁切换工具模式不报错**
- [ ] 长时间操作（10+ 分钟）不报错
- [ ] 多选后移动不报错
- [ ] 删除对象后不报错
