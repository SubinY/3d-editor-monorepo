import { describe, expect, it } from 'vitest'
import { DocumentSelection } from '../selection'

function create() {
  const events: string[][] = []
  const selection = new DocumentSelection(ids => {
    events.push(ids)
  })
  return { selection, events }
}

describe('DocumentSelection', () => {
  it('去重并保持首次出现顺序，首项是 primary', () => {
    const { selection } = create()
    selection.set(['b', 'a', 'b', '', 'a'])
    expect(selection.get()).toEqual(['b', 'a'])
    expect(selection.primary()).toBe('b')
    expect(selection.first()).toBe('b')
  })

  it('toggle 追加到末尾，再 toggle 移除且不改其余顺序', () => {
    const { selection, events } = create()
    selection.toggle('a')
    selection.toggle('b')
    expect(selection.get()).toEqual(['a', 'b'])
    selection.toggle('a')
    expect(selection.get()).toEqual(['b'])
    expect(selection.primary()).toBe('b')
    expect(events.map(ids => [...ids])).toEqual([['a'], ['a', 'b'], ['b']])
  })

  it('相同内容不重复通知', () => {
    const { selection, events } = create()
    selection.set(['a'])
    selection.add('a')
    selection.set(['a', 'a'])
    expect(events).toHaveLength(1)
  })
})
