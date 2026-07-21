import * as THREE from 'three'

export class AnimationSystem {
  private mixers: Set<THREE.AnimationMixer> = new Set()

  add(object: THREE.Object3D, clips: THREE.AnimationClip[] = []): THREE.AnimationMixer {
    const mixer = new THREE.AnimationMixer(object)
    clips.forEach(clip => mixer.clipAction(clip).play())
    this.mixers.add(mixer)
    return mixer
  }

  update(delta: number): void {
    this.mixers.forEach(mixer => mixer.update(delta))
  }
}
