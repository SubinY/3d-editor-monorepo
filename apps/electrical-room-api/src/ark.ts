import { getLlmConfig } from './env.js'

/** Stage-1: vision → structured part inventory (JSON only). */
export const INVENTORY_SYSTEM_PROMPT = `You are a 3D intake analyst for electrical equipment photos.
Observe before inventing. Use 3D object-space terms (cuboid, recess, overhang, faceplate, terminal bay) — never "nice/pretty".

Output ONLY a JSON object (no markdown fences, no prose) with this shape:
{
  "objectClass": "short class e.g. molded-case-circuit-breaker",
  "identityFeatures": ["8-12 identity-defining visible features"],
  "parts": [
    { "id": "kebab-id", "role": "shell|line-terminals|load-terminals|faceplate|handle|trip|micrologic|label|other", "notes": "brief geometry note" }
  ],
  "colors": { "shell": "#hex", "faceplate": "#hex", "handle": "#hex", "accent": "#hex" },
  "footprintMeters": { "width": 0.14, "depth": 0.11, "height": 0.255 },
  "materials": [
    { "id": "shell", "finish": "matte-plastic", "color": "#2f3238", "roughness": 0.78, "metalness": 0.05 }
  ],
  "labels": ["readable text/logos visible on front, e.g. ComPacT, OFF, MicroLogic 2.3"],
  "approximations": ["what the single view hides or you must approximate"]
}

Rules:
- If the user message includes a FIXED footprint, copy those exact width/depth/height into footprintMeters — do not invent dimensions.
- Otherwise footprintMeters must be real-world-ish meters for a catalog prop (MCCB often ~0.10–0.16 W, ~0.20–0.28 H, ~0.09–0.12 D).
- Require parts for: main shell, upper LINE terminals (recessed if visible), lower LOAD terminals, primary front faceplate/control zone, operating handle if present.
- List every high-contrast colour region and every readable brand/status label.
- If translucent dial cover / rating plate / orange trip are visible, include them as parts.
`

/** Stage-2: inventory + image → createModel TypeScript. */
export const MODEL_FACTORY_SYSTEM_PROMPT = `You are a Three.js procedural model factory for an electrical-room editor.

Output ONLY TypeScript (prefer a fenced \`\`\`typescript block). No prose.

Hard contract:
1. Export exactly: export function createModel(THREE, options)
2. options.footprint = { width, depth, height? } in meters — ALWAYS derive ALL sizes as fractions of w/d/h from options.footprint. NEVER hardcode absolute meter constants for the outer envelope. Prefer options.footprint.height when provided.
3. Root is THREE.Group; origin at bottom-center; geometry in y ∈ [0, h]; front faces +Z
4. Do NOT import 'three' or any module — use the injected THREE argument only
5. Soft budget: prefer ≤80 meshes. Identity details beat minimalism — NEVER ship a single box as the whole model
6. castShadow/receiveShadow on solid meshes; name every mesh/group (kebab-case)
7. Allowed toolbox: BoxGeometry, PlaneGeometry, CylinderGeometry; MeshStandardMaterial; MeshPhysicalMaterial for translucent covers; CanvasTexture + PlaneGeometry for logos/text/ratings (draw with 2d canvas). No external textures/URLs
8. Implement the inventory parts: recessed terminal bays (not flat lids only), extruded faceplate, protruding handle, distinct materials per zone, canvas labels for brand/status/dial legends when listed
9. The Host passes a FIXED footprint; the mesh MUST fill that envelope (outer shell ≈ w × h × d). Do not invent a different overall size.

Forbidden:
- One main cuboid with no faceplate/handle/terminals
- Fake photogrammetry / imported GLTF
- import 'three'

Compact pattern reference (signature + techniques — adapt colours/layout to THIS image + inventory):

\`\`\`typescript
export function createModel(THREE, options) {
  const w = options.footprint.width
  const d = options.footprint.depth
  const h = options.footprint.height ?? 0.14
  const root = new THREE.Group()
  root.name = 'component'

  const shellMat = new THREE.MeshStandardMaterial({ color: '#2f3238', roughness: 0.78, metalness: 0.05 })
  const faceMat = new THREE.MeshStandardMaterial({ color: '#00a651', roughness: 0.52, metalness: 0.04 })
  const darkMat = new THREE.MeshStandardMaterial({ color: '#121417', roughness: 0.62, metalness: 0.08 })

  function mark(mesh) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  function box(bw, bh, bd, mat, name) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat)
    if (name) m.name = name
    return mark(m)
  }
  function canvasTex(draw, tw, th) {
    const c = document.createElement('canvas')
    c.width = tw
    c.height = th
    const ctx = c.getContext('2d')
    draw(ctx, tw, th)
    const tex = new THREE.CanvasTexture(c)
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }
  function labelPlane(pw, ph, tex, name) {
    const mat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.55, metalness: 0, depthWrite: false
    })
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat)
    if (name) m.name = name
    return m
  }

  const body = box(w * 0.98, h * 0.88, d * 0.9, shellMat, 'shell')
  body.position.set(0, h * 0.5, 0)
  root.add(body)

  const face = box(w * 0.55, h * 0.28, d * 0.05, faceMat, 'faceplate')
  face.position.set(0, h * 0.55, d * 0.42)
  root.add(face)

  const handle = box(w * 0.14, h * 0.12, d * 0.14, darkMat, 'handle')
  handle.position.set(0, h * 0.5, d * 0.52)
  root.add(handle)

  const termGroup = new THREE.Group()
  termGroup.name = 'line-terminals'
  for (let i = -1; i <= 1; i++) {
    const bay = box(w * 0.22, h * 0.07, d * 0.28, darkMat, 'line-bay')
    bay.position.set(i * w * 0.3, h * 0.93, d * 0.2)
    termGroup.add(bay)
    const recess = box(w * 0.14, h * 0.045, d * 0.16, shellMat, 'line-recess')
    recess.position.set(i * w * 0.3, h * 0.94, d * 0.28)
    termGroup.add(recess)
  }
  root.add(termGroup)

  const brandTex = canvasTex((ctx, tw, th) => {
    ctx.fillStyle = '#00a651'
    ctx.fillRect(0, 0, tw, th)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px Arial, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('Brand', 16, th * 0.55)
  }, 512, 96)
  const brand = labelPlane(w * 0.5, h * 0.04, brandTex, 'brand-label')
  brand.position.set(0, h * 0.68, d * 0.455)
  root.add(brand)

  return root
}
\`\`\`
`

export interface ModelInventory {
  objectClass: string
  identityFeatures: string[]
  parts: Array<{ id: string; role: string; notes?: string }>
  colors: Record<string, string>
  footprintMeters: { width: number; depth: number; height: number }
  materials: Array<{
    id: string
    finish: string
    color?: string
    roughness?: number
    metalness?: number
  }>
  labels: string[]
  approximations: string[]
}

function clampFootprint(fp: {
  width: number
  depth: number
  height: number
}): { width: number; depth: number; height: number } {
  const clamp = (n: number, lo: number, hi: number, fallback: number) => {
    const v = Number(n)
    if (!Number.isFinite(v) || v <= 0) return fallback
    return Math.min(hi, Math.max(lo, v))
  }
  return {
    width: clamp(fp.width, 0.04, 0.6, 0.12),
    depth: clamp(fp.depth, 0.04, 0.5, 0.1),
    height: clamp(fp.height, 0.06, 0.8, 0.18)
  }
}

function pickMessageContent(message: {
  content?: string | null
  reasoning_content?: string | null
}): string {
  if (typeof message.content === 'string' && message.content.trim()) return message.content
  // 部分思考模型偶发把正文放在其它字段；仍以 content 为主
  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
    return message.reasoning_content
  }
  return ''
}

/** Kimi OpenAI-compatible chat/completions（须支持 image_url 的多模态模型）。 */
async function llmChat(
  body: Record<string, unknown>,
  opts?: { includeReasoningEffort?: boolean }
): Promise<string> {
  const { apiKey, model, baseUrl, reasoningEffort } = getLlmConfig()

  const payload: Record<string, unknown> = {
    model,
    ...body
  }

  // Kimi K3 用顶层 reasoning_effort；文档建议部分模型勿乱设 temperature
  if (opts?.includeReasoningEffort !== false && /^kimi-k3/i.test(model) && reasoningEffort) {
    payload.reasoning_effort = reasoningEffort
  }
  // 对 K3 / 新模型去掉可能导致 400 的 temperature（由调用方可选传入；此处统一剥离）
  if (/^kimi-k3/i.test(model) || /^kimi-k2\.[567]/i.test(model) || /^kimi-k2\.7/i.test(model)) {
    delete payload.temperature
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  })

  const parsed = (await res.json()) as {
    error?: { message?: string; code?: string; type?: string }
    choices?: Array<{
      message?: { content?: string | null; reasoning_content?: string | null }
    }>
  }

  if (!res.ok) {
    const msg = parsed.error?.message || res.statusText
    const hint =
      /image|vision|multimodal|unsupported|model/i.test(msg)
        ? ' — 请改用支持视觉的模型（推荐 KIMI_MODEL=kimi-k3，见 https://platform.kimi.com/docs/guide/use-kimi-vision-model）'
        : ''
    const err = new Error(`Kimi API ${res.status}: ${msg}${hint}`) as Error & { status?: number }
    err.status = 502
    throw err
  }

  const rawContent = pickMessageContent(parsed.choices?.[0]?.message ?? {})
  if (!rawContent.trim()) {
    const err = new Error('Kimi returned empty content') as Error & { status?: number }
    err.status = 502
    throw err
  }
  return rawContent
}

function toDataUrl(mimeType: string, imageBase64: string): string {
  const b64 = imageBase64.replace(/^data:[^;]+;base64,/, '')
  let mime = (mimeType || 'image/png').toLowerCase()
  if (mime === 'image/jpg') mime = 'image/jpeg'
  return `data:${mime};base64,${b64}`
}

function imageContent(dataUrl: string, text: string) {
  return [
    { type: 'image_url', image_url: { url: dataUrl } },
    { type: 'text', text }
  ]
}

export function extractTypeScriptSource(content: string): string {
  const fenced = content.match(/```(?:typescript|ts|javascript|js)?\s*([\s\S]*?)```/i)
  let code = (fenced ? fenced[1] : content).trim()
  if (!/export\s+function\s+createModel\s*\(/.test(code)) {
    const err = new Error(
      'model output missing export function createModel(...); check KIMI_MODEL supports vision + code output'
    ) as Error & { status?: number }
    err.status = 502
    throw err
  }
  if (/\bimport\s+['"]three['"]/.test(code) || /\bfrom\s+['"]three['"]/.test(code)) {
    const err = new Error('generated code must not import three') as Error & { status?: number }
    err.status = 502
    throw err
  }
  return code
}

export function extractInventoryJson(content: string): ModelInventory {
  let text = content.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    const err = new Error('inventory response missing JSON object') as Error & { status?: number }
    err.status = 502
    throw err
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    const err = new Error('inventory JSON parse failed') as Error & { status?: number }
    err.status = 502
    throw err
  }
  const obj = parsed as Partial<ModelInventory>
  if (!obj || typeof obj !== 'object') {
    const err = new Error('invalid inventory') as Error & { status?: number }
    err.status = 502
    throw err
  }
  const fp = obj.footprintMeters ?? { width: 0.12, depth: 0.1, height: 0.18 }
  return {
    objectClass: String(obj.objectClass || 'electrical-component'),
    identityFeatures: Array.isArray(obj.identityFeatures)
      ? obj.identityFeatures.map(String)
      : [],
    parts: Array.isArray(obj.parts)
      ? obj.parts.map(p => ({
          id: String(p?.id || 'part'),
          role: String(p?.role || 'other'),
          notes: p?.notes != null ? String(p.notes) : undefined
        }))
      : [],
    colors:
      obj.colors && typeof obj.colors === 'object'
        ? Object.fromEntries(Object.entries(obj.colors).map(([k, v]) => [k, String(v)]))
        : {},
    footprintMeters: clampFootprint({
      width: Number(fp.width),
      depth: Number(fp.depth),
      height: Number(fp.height)
    }),
    materials: Array.isArray(obj.materials)
      ? obj.materials.map(m => ({
          id: String(m?.id || 'mat'),
          finish: String(m?.finish || 'plastic'),
          color: m?.color != null ? String(m.color) : undefined,
          roughness: typeof m?.roughness === 'number' ? m.roughness : undefined,
          metalness: typeof m?.metalness === 'number' ? m.metalness : undefined
        }))
      : [],
    labels: Array.isArray(obj.labels) ? obj.labels.map(String) : [],
    approximations: Array.isArray(obj.approximations) ? obj.approximations.map(String) : []
  }
}

export function normalizeFootprint(raw: unknown): {
  width: number
  depth: number
  height: number
} {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const width = Number(obj.width)
  const depth = Number(obj.depth)
  const height = Number(obj.height)
  if (![width, depth, height].every(n => Number.isFinite(n) && n > 0)) {
    const err = new Error(
      'footprint required: { width, depth, height } in meters, all > 0'
    ) as Error & { status?: number }
    err.status = 400
    throw err
  }
  return clampFootprint({ width, depth, height })
}

export async function generateInventory(params: {
  imageBase64: string
  mimeType: string
  name?: string
  footprint: { width: number; depth: number; height: number }
}): Promise<{ inventory: ModelInventory; rawContent: string }> {
  const mime = params.mimeType || 'image/png'
  const dataUrl = toDataUrl(mime, params.imageBase64)
  const label = params.name?.trim() || 'electrical component'
  const fp = params.footprint

  const rawContent = await llmChat({
    messages: [
      { role: 'system', content: INVENTORY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: imageContent(
          dataUrl,
          `Analyze this reference photo of "${label}". Produce the inventory JSON only.

FIXED footprintMeters (meters, must copy exactly — do not invent size):
${JSON.stringify(fp)}`
        )
      }
    ],
    max_tokens: 4096
  })

  const inventory = extractInventoryJson(rawContent)
  inventory.footprintMeters = { ...fp }
  return { inventory, rawContent }
}

export async function generateCodeFromInventory(params: {
  imageBase64: string
  mimeType: string
  name?: string
  inventory: ModelInventory
  footprint: { width: number; depth: number; height: number }
}): Promise<{ sourceCode: string; rawContent: string }> {
  const mime = params.mimeType || 'image/png'
  const dataUrl = toDataUrl(mime, params.imageBase64)
  const label = params.name?.trim() || 'electrical component'
  const fp = params.footprint
  const inventory = {
    ...params.inventory,
    footprintMeters: { ...fp }
  }
  const inventoryJson = JSON.stringify(inventory, null, 2)

  const rawContent = await llmChat({
    messages: [
      { role: 'system', content: MODEL_FACTORY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: imageContent(
          dataUrl,
          `Rebuild "${label}" as createModel for a browser Three.js editor.

FIXED envelope (meters) — Host will call createModel(THREE, { footprint: ${JSON.stringify(fp)} }).
The root mesh MUST fit this box: width=${fp.width}, depth=${fp.depth}, height=${fp.height}.
Scale every part as fractions of w/d/h from options.footprint — never hardcode a different overall size.

Follow this inventory for parts/colours/labels/materials:
${inventoryJson}

Return only the TypeScript source.`
        )
      }
    ],
    max_tokens: 16384
  })

  return { sourceCode: extractTypeScriptSource(rawContent), rawContent }
}

/** Two-stage: inventory → createModel source. Footprint is Host-fixed. */
export async function generateFactorySource(params: {
  imageBase64: string
  mimeType: string
  name?: string
  footprint: { width: number; depth: number; height: number }
}): Promise<{
  sourceCode: string
  rawContent: string
  inventory: ModelInventory
  inventoryRaw: string
}> {
  const footprint = normalizeFootprint(params.footprint)
  const { inventory, rawContent: inventoryRaw } = await generateInventory({
    ...params,
    footprint
  })
  const { sourceCode, rawContent } = await generateCodeFromInventory({
    ...params,
    inventory,
    footprint
  })
  return {
    sourceCode,
    rawContent,
    inventory: { ...inventory, footprintMeters: { ...footprint } },
    inventoryRaw
  }
}

export async function repairFactorySource(params: {
  sourceCode: string
  compileError: string
}): Promise<string> {
  const rawContent = await llmChat(
    {
      messages: [
        { role: 'system', content: MODEL_FACTORY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Fix this createModel TypeScript so it compiles with esbuild (external three). Keep the same contract and part structure.\n\nCompile error:\n${params.compileError}\n\nSource:\n\`\`\`typescript\n${params.sourceCode}\n\`\`\``
        }
      ],
      max_tokens: 16384
    },
    { includeReasoningEffort: false }
  )
  return extractTypeScriptSource(rawContent)
}
