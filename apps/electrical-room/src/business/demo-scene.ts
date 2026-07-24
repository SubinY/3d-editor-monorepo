import {
  createEditor,
  createEmptyDocumentJSON,
  createMemoryCatalog
} from '@3d-editor/editor'
import type { EditorDocumentJSON } from '@3d-editor/editor'
import { builtinCabinetItems } from './catalog'

/**
 * 示例场景：20m × 15m 电柜室，两列各 5 台不同型号电柜（面向中间过道）。
 * 首次进入且无存档时使用。
 */
export async function createDemoSceneJSON(): Promise<EditorDocumentJSON> {
  const cabinets = builtinCabinetItems()
  const editor = await createEditor({
    catalog: createMemoryCatalog(cabinets),
    document: createEmptyDocumentJSON({
      kind: 'scene',
      name: '示例电柜室',
      bounds: { width: 20, depth: 15 }
    })
  })

  const doc = editor.document
  doc.createRectRoom({ height: 3, thickness: 0.24 })

  const [power, control] = cabinets
  const rows = [-5, -2.5, 0, 2.5, 5]

  rows.forEach((z, index) => {
    doc.commands.placeItem(index % 2 === 0 ? power : control, {
      position: [-4, 0, z],
      rotation: [0, Math.PI / 2, 0],
      name: `左列柜-${index + 1}`,
      props: { circuit: `L-${index + 1}` },
      select: false
    })
    doc.commands.placeItem(index % 2 === 0 ? control : power, {
      position: [4, 0, z],
      rotation: [0, -Math.PI / 2, 0],
      name: `右列柜-${index + 1}`,
      props: { circuit: `R-${index + 1}` },
      select: false
    })
  })

  const json = doc.toJSON()
  editor.dispose()
  return json
}
