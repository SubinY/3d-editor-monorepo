export type LiveCameraPose = {
  position: [number, number, number]
  target: [number, number, number]
  radius: number
}

export type EnvSectionId = 'camera' | 'light' | 'helpers' | 'background'
