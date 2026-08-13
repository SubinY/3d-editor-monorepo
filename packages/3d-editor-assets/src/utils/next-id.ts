/** 进程内递增 id（编辑器会话用；非全局唯一） */
let seq = 0

export function nextId(prefix = 'id'): string {
  seq += 1
  return `${prefix}-${seq}`
}
