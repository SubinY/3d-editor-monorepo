/**
 * 对齐 spms-client `ApiEnvelope`，模拟线上业务响应壳。
 * - `code` / `msg`：业务层状态（非 HTTP status）
 * - `code === 0` 表示成功
 */

export const API_CODE = {
  OK: 0,
} as const

export interface ApiEnvelope<T> {
  code: number
  msg: string | null
  data: T
}

/** GET/PUT layout 的 data 载荷 */
export interface DocumentData {
  document: Record<string, unknown> | null
}

export function okEnvelope<T>(data: T, msg: string | null = null): ApiEnvelope<T> {
  return { code: API_CODE.OK, data, msg }
}

export function failEnvelope(
  code: number,
  msg: string,
  data: null = null,
): ApiEnvelope<null> {
  return { code, msg, data }
}
