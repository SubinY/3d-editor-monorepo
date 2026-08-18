import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 从 apps/electrical-room-api/.env 加载到 process.env（不覆盖已有） */
export function loadDotEnv(): void {
  const envPath = path.resolve(__dirname, '../.env')
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export type LlmProvider = 'kimi'

export interface LlmConfig {
  provider: LlmProvider
  apiKey: string
  /** OpenAI-compatible model id, e.g. kimi-k3 */
  model: string
  baseUrl: string
  /** Kimi K3: low | high | max；其它模型可忽略 */
  reasoningEffort?: 'low' | 'high' | 'max'
}

/**
 * 模型工厂 LLM（当前为 Kimi / Moonshot，OpenAI 兼容）。
 * Key 优先 KIMI_API_KEY，其次 MOONSHOT_API_KEY。
 */
export function getLlmConfig(): LlmConfig {
  const apiKey =
    process.env.KIMI_API_KEY?.trim() ||
    process.env.MOONSHOT_API_KEY?.trim() ||
    ''
  const model = (process.env.KIMI_MODEL?.trim() || 'kimi-k3').replace(/^["']|["']$/g, '')
  const baseUrl = (
    process.env.KIMI_BASE_URL?.trim() ||
    process.env.MOONSHOT_BASE_URL?.trim() ||
    'https://api.moonshot.cn/v1'
  ).replace(/\/$/, '')

  const effortRaw = (process.env.KIMI_REASONING_EFFORT?.trim() || 'high').toLowerCase()
  const reasoningEffort =
    effortRaw === 'low' || effortRaw === 'high' || effortRaw === 'max' ? effortRaw : 'high'

  if (!apiKey) {
    const err = new Error(
      'KIMI_API_KEY (or MOONSHOT_API_KEY) missing; copy .env.example to .env — https://platform.kimi.com/console/api-keys'
    ) as Error & { status?: number }
    err.status = 500
    throw err
  }

  return {
    provider: 'kimi',
    apiKey,
    model,
    baseUrl,
    reasoningEffort
  }
}

/** @deprecated use getLlmConfig */
export function getArkConfig(): { apiKey: string; endpointId: string; baseUrl: string } {
  const c = getLlmConfig()
  return { apiKey: c.apiKey, endpointId: c.model, baseUrl: c.baseUrl }
}
