import * as THREE from 'three'

export const createStandardMaterial = (color: number | string = 0xffffff): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color })

export const createBasicMaterial = (color: number | string = 0xffffff, wireframe = false): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, wireframe })
