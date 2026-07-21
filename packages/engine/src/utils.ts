export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min
  if (value > max) return max
  return value
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const uuid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const degToRad = (degrees: number): number => (degrees * Math.PI) / 180
export const radToDeg = (radians: number): number => (radians * 180) / Math.PI

export const noop = (): void => undefined
