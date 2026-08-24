let counter = 0

export function createId(prefix = 'node'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

/** 浏览器可用的 UUID 字符串（不依赖 Secure Context / crypto） */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
