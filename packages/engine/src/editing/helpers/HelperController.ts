export interface HelperToggle {
  axes?: boolean
  grid?: boolean
  boundingBox?: boolean
}

export class HelperController {
  constructor(public toggles: HelperToggle = {}) {}

  setToggle(key: keyof HelperToggle, value: boolean): void {
    this.toggles[key] = value
  }
}
