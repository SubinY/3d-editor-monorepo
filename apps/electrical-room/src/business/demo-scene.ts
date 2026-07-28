import {
  createEditor,
  createEmptyDocumentJSON,
  createMemoryCatalog
} from '@3d-editor/editor'
import type { EditorDocumentJSON } from '@3d-editor/editor'
import {
  builtinCabinetDocuments,
  cabinetItemFromDocument,
  INITIAL_CABINET_VERSION
} from './catalog'
import * as api from './api'
import { createConditionEvent, createPointBinding } from './node-bindings'

/**
 * 示例场景：写入 API（文档 + 柜 Catalog），返回 scene JSON。
 */
export async function createDemoSceneJSON(): Promise<EditorDocumentJSON> {
  const docs = builtinCabinetDocuments()
  const thumbs = ['#3f7fbf', '#3fae8a']
  const cabinets = []

  for (let i = 0; i < docs.length; i++) {
    const docJson = docs[i]
    await api.saveDocument(docJson)
    const item = cabinetItemFromDocument(docJson, INITIAL_CABINET_VERSION, { thumb: thumbs[i] })
    try {
      await api.postCatalogItem(item)
    } catch {
      await api.putCatalogItem(item)
    }
    cabinets.push(item)
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
    const sampleBindings =
      index === 0
        ? {
            bindings: [createPointBinding('temp', '柜温')],
            events: [
              createConditionEvent({
                name: '过温故障',
                when: { pointKey: 'temp', op: 'gt', value: 60 },
                then: { highlight: 'fault' }
              })
            ]
          }
        : index === 1
          ? {
              bindings: [createPointBinding('alarm', '告警')],
              events: [
                createConditionEvent({
                  name: '告警码',
                  when: { pointKey: 'alarm', op: 'eq', value: 1 },
                  then: { highlight: 'warning' }
                })
              ]
            }
          : undefined

    doc.commands.placeItem(index % 2 === 0 ? power : control, {
      position: [-4, 0, z],
      rotation: [0, Math.PI / 2, 0],
      name: `左列柜-${index + 1}`,
      props: { circuit: `L-${index + 1}`, ...sampleBindings },
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
  await api.saveDocument(json)
  return json
}
