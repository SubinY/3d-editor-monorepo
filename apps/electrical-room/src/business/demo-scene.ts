import {
  createEditor,
  createEmptyDocumentJSON,
  createMemoryCatalog
} from '@mh/3d-editor'
import type { EditorDocumentJSON } from '@mh/3d-editor'
import { createTwinPoint, createTwinRule } from '@mh/3d-editor-twin'
import {
  builtinCabinetDocuments,
  cabinetItemFromDocument,
  INITIAL_CABINET_VERSION
} from './catalog'
import * as api from './api'

/**
 * 示例场景：只写分命名空间 documents（柜 container + 室 scene），不双写 catalog。
 */
export async function createDemoSceneJSON(): Promise<EditorDocumentJSON> {
  const docs = builtinCabinetDocuments()
  const thumbs = ['#3f7fbf', '#3fae8a']
  const cabinets = []

  for (let i = 0; i < docs.length; i++) {
    const docJson = docs[i]
    await api.saveDocument(docJson)
    cabinets.push(
      cabinetItemFromDocument(docJson, INITIAL_CABINET_VERSION, { thumb: thumbs[i] })
    )
  }

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
    const sampleTwin =
      index === 0
        ? {
            twin: {
              points: [createTwinPoint('temp', { alias: '柜温' })],
              rules: [
                createTwinRule({
                  name: '过温故障',
                  when: { point: 'temp', op: 'gt', value: 60 },
                  then: { slots: { highlight: 'fault' } }
                })
              ]
            }
          }
        : index === 1
          ? {
              twin: {
                points: [createTwinPoint('alarm', { alias: '告警' })],
                rules: [
                  createTwinRule({
                    name: '告警码',
                    when: { point: 'alarm', op: 'eq', value: 1 },
                    then: { slots: { highlight: 'warning' } }
                  })
                ]
              }
            }
          : undefined

    doc.commands.placeItem(index % 2 === 0 ? power : control, {
      position: [-4, 0, z],
      rotation: [0, Math.PI / 2, 0],
      name: `左列柜-${index + 1}`,
      props: sampleTwin,
      select: false
    })
    doc.commands.placeItem(index % 2 === 0 ? control : power, {
      position: [4, 0, z],
      rotation: [0, -Math.PI / 2, 0],
      name: `右列柜-${index + 1}`,
      select: false
    })
  })

  const json = doc.toJSON()
  editor.dispose()
  await api.saveDocument(json)
  return json
}
