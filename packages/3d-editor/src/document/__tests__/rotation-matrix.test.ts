import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { rotationMatrix } from '../collision'

describe('rotationMatrix', () => {
  it('存盘 (π/2, π/2, 0) 等于先世界 X 再世界 Y 各顺时针 90°', () => {
    const m = rotationMatrix([Math.PI / 2, Math.PI / 2, 0])
    const expected = new THREE.Object3D()
    expected.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    expected.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
    expected.updateMatrix()
    const e = expected.matrix.elements
    const got = [m.r00, m.r10, m.r20, m.r01, m.r11, m.r21, m.r02, m.r12, m.r22]
    const want = [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]]
    for (let i = 0; i < got.length; i++) {
      expect(got[i]).toBeCloseTo(want[i], 5)
    }
  })
})