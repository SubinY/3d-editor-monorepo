import * as THREE from 'three'

export const createBox = (width = 1, height = 1, depth = 1): THREE.BoxGeometry =>
  new THREE.BoxGeometry(width, height, depth)

export const createPlane = (width = 1, height = 1): THREE.PlaneGeometry =>
  new THREE.PlaneGeometry(width, height)

export const createSphere = (radius = 1, widthSegments = 32, heightSegments = 16): THREE.SphereGeometry =>
  new THREE.SphereGeometry(radius, widthSegments, heightSegments)
