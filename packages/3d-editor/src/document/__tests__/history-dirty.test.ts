import { describe, expect, it } from 'vitest'
import { DocumentHistory } from '../history'

function pushLabel(history: DocumentHistory, label: string) {
  let applied = true
  history.push({
    label,
    undo: () => {
      applied = false
    },
    redo: () => {
      applied = true
    }
  })
  return () => applied
}

describe('DocumentHistory dirty', () => {
  it('starts clean and becomes dirty after push', () => {
    const history = new DocumentHistory()
    expect(history.isDirty()).toBe(false)
    pushLabel(history, 'a')
    expect(history.isDirty()).toBe(true)
  })

  it('markClean then undo back to clean point clears dirty', () => {
    const history = new DocumentHistory()
    pushLabel(history, 'a')
    history.markClean()
    expect(history.isDirty()).toBe(false)
    pushLabel(history, 'b')
    expect(history.isDirty()).toBe(true)
    history.undo()
    expect(history.isDirty()).toBe(false)
  })

  it('markDirty forces dirty until markClean', () => {
    const history = new DocumentHistory()
    expect(history.isDirty()).toBe(false)
    history.markDirty()
    expect(history.isDirty()).toBe(true)
    history.markClean()
    expect(history.isDirty()).toBe(false)
  })

  it('discarding redo past clean point stays dirty', () => {
    const history = new DocumentHistory()
    pushLabel(history, 'a')
    history.markClean()
    pushLabel(history, 'b')
    history.undo()
    expect(history.isDirty()).toBe(false)
    pushLabel(history, 'c')
    expect(history.isDirty()).toBe(true)
  })
})
