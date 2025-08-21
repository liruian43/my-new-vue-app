// src/components/Data/services/id.js
// 职责：全局唯一的 ID/Key 规则中心
// 规则：Key = {系统前缀}:{版号}:{类型}:{ExcelID}
// - 系统前缀：区分 localStorage 命名空间（默认 'APP'）
// - 版号：任意非空字符串（外部保证不重复，如 'V1'、'抓娃娃' 等）
// - 类型：仅两类 —— 题库(questionBank) 与 全量区(envFull)
// - ExcelID：卡片级（A, B..Z, AA..）或选项级（字母+数字，如 A6、AB12）
//
// 说明：你可以分散独立使用其中任意部分（比如只用卡片ID或选项ID），
// 在需要落盘/定位时，再用 buildKey 统一组合成固定四段的 Key。

// -----------------------------
// 系统前缀（本地存储命名空间）
// -----------------------------
let SYSTEM_PREFIX = 'APP'

export function setSystemPrefix(prefix) {
  const p = String(prefix || '').trim()
  if (!p) throw new Error('SYSTEM_PREFIX 不能为空')
  SYSTEM_PREFIX = p
}
export function getSystemPrefix() {
  return SYSTEM_PREFIX
}

// -----------------------------
// 版本号（任意非空字符串，外部保证唯一）
// -----------------------------
export function normalizeVersionLabel(label) {
  return String(label ?? '').trim()
}
export function isValidVersionLabel(label) {
  return normalizeVersionLabel(label).length > 0
}

// -----------------------------
// 类型（题库/全量区）规范化与校验
// 统一输出：questionBank / envFull
// 支持多种别名（含中文/QB/ENV等）输入
// -----------------------------
export const TYPES = Object.freeze({
  QUESTION_BANK: 'questionBank',
  ENV_FULL: 'envFull'
})

const TYPE_ALIASES = Object.freeze({
  // 题库
  questionBank: TYPES.QUESTION_BANK,
  qb: TYPES.QUESTION_BANK,
  QB: TYPES.QUESTION_BANK,
  '题库': TYPES.QUESTION_BANK,

  // 全量区
  envFull: TYPES.ENV_FULL,
  env: TYPES.ENV_FULL,
  ENV: TYPES.ENV_FULL,
  ENV_FULL: TYPES.ENV_FULL,
  full: TYPES.ENV_FULL,
  FULL: TYPES.ENV_FULL,
  '全量区': TYPES.ENV_FULL
})

export function normalizeType(type) {
  const t = String(type || '').trim()
  return TYPE_ALIASES[t] || t
}
export function isValidType(type) {
  const t = normalizeType(type)
  return t === TYPES.QUESTION_BANK || t === TYPES.ENV_FULL
}

// -----------------------------
// Excel 风格 ID（卡片/选项）
// - 卡片ID：纯大写字母（A..Z, AA..）
// - 选项ID：纯数字（1..N）
// - 选项级 ExcelID：字母+数字（如 A6）= 卡片ID + 选项ID
// -----------------------------
export function isValidCardId(id) {
  return /^[A-Z]+$/.test(String(id || ''))
}
export function normalizeCardId(id) {
  const s = String(id || '').trim().toUpperCase()
  if (!isValidCardId(s)) throw new Error(`无效卡片ID: ${id}`)
  return s
}

// 比较卡片ID：先按长度，后按字典序（Excel 列序）
export function compareCardIds(id1, id2) {
  const a = String(id1 || '')
  const b = String(id2 || '')
  if (a.length !== b.length) return a.length - b.length
  return a.localeCompare(b)
}

// 从已用ID集合/数组生成下一个卡片ID（A → B → ... → Z → AA → AB ...）
export function generateNextCardId(used) {
  const set = used instanceof Set ? used : new Set(used || [])
  let currentMax = ''
  for (const x of set.values()) {
    const id = String(x || '')
    if (isValidCardId(id) && compareCardIds(id, currentMax) > 0) currentMax = id
  }
  if (!currentMax) return 'A'

  const chars = currentMax.split('')
  let i = chars.length - 1
  while (i >= 0 && chars[i] === 'Z') { chars[i] = 'A'; i-- }
  if (i < 0) chars.unshift('A')
  else chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
  return chars.join('')
}

export function isValidOptionId(id) {
  return /^\d+$/.test(String(id || ''))
}
export function normalizeOptionId(id) {
  const s = String(id || '').trim()
  if (!isValidOptionId(s)) throw new Error(`无效选项ID: ${id}`)
  return s
}

// 接受 ['1','2'] 或 [{id:'1'}, {id:'2'}]
export function generateNextOptionId(existing) {
  const list = Array.isArray(existing) ? existing : []
  let max = 0
  for (const it of list) {
    const v = typeof it === 'object' && it !== null ? it.id : it
    const n = parseInt(String(v), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return String(max + 1)
}

// 组合/解析 选项级 ExcelID：如 A6
export function buildFullOptionId(cardId, optionId) {
  const c = normalizeCardId(cardId)
  const o = normalizeOptionId(optionId)
  return `${c}${o}`
}
export function parseFullOptionId(fullId) {
  const m = String(fullId || '').toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return { cardId: null, optionId: null, valid: false }
  return { cardId: m[1], optionId: m[2], valid: true }
}
export function compareFullOptionIds(a, b) {
  const A = parseFullOptionId(a)
  const B = parseFullOptionId(b)
  if (!A.valid && !B.valid) return 0
  if (!A.valid) return -1
  if (!B.valid) return 1
  const c = compareCardIds(A.cardId, B.cardId)
  return c !== 0 ? c : (parseInt(A.optionId, 10) - parseInt(B.optionId, 10))
}

// ExcelID 判别/归一化/拆分（支持 'a'/'a6' -> 'A'/'A6'）
export function isCardExcelId(excelId) {
  return isValidCardId(String(excelId || '').toUpperCase())
}
export function isOptionExcelId(excelId) {
  return /^([A-Z]+)(\d+)$/.test(String(excelId || '').toUpperCase())
}
export function isValidExcelId(excelId) {
  const s = String(excelId || '').toUpperCase()
  return isCardExcelId(s) || isOptionExcelId(s)
}
export function excelIdKind(excelId) {
  const s = String(excelId || '').toUpperCase()
  if (isCardExcelId(s)) return 'card'
  if (isOptionExcelId(s)) return 'option'
  return null
}
export function normalizeExcelId(excelId) {
  const s = String(excelId || '').trim().toUpperCase()
  if (isCardExcelId(s)) return s
  const m = s.match(/^([A-Z]+)(\d+)$/)
  if (m) return `${m[1]}${m[2]}`
  throw new Error(`无效 ExcelID: ${excelId}（应为卡片ID如 A 或选项ID如 A6）`)
}
// 语义更直观的别名（等价于 buildFullOptionId）
export function buildExcelId(cardId, optionId) {
  return buildFullOptionId(cardId, optionId)
}
export function splitExcelId(excelId) {
  const s = normalizeExcelId(excelId)
  if (isCardExcelId(s)) return { kind: 'card', cardId: s, optionId: null }
  const { cardId, optionId, valid } = parseFullOptionId(s)
  if (!valid) throw new Error(`无法解析 ExcelID: ${excelId}`)
  return { kind: 'option', cardId, optionId }
}

// -----------------------------
// Key 组合/解析（固定四段）
// Key = prefix:version:type:excelId
// 各段做 URL 安全编码，避免中文/特殊字符导致的存储键问题。
// -----------------------------
function enc(x) { return encodeURIComponent(String(x ?? '')) }
function dec(x) { try { return decodeURIComponent(String(x ?? '')) } catch { return String(x ?? '') } }

export function buildKey({ version, type, excelId, prefix }) {
  const p = String(prefix || SYSTEM_PREFIX).trim()
  if (!p) throw new Error('prefix 不能为空')

  const v = normalizeVersionLabel(version)
  if (!isValidVersionLabel(v)) throw new Error('版本号不能为空')

  const t = normalizeType(type)
  if (!isValidType(t)) throw new Error(`无效类型: ${type}（有效值：questionBank / envFull，或其别名/中文）`)

  const e = normalizeExcelId(excelId)

  return `${enc(p)}:${enc(v)}:${enc(t)}:${enc(e)}`
}

export function parseKey(key) {
  const s = String(key || '')
  const parts = s.split(':')
  if (parts.length !== 4) return { valid: false }
  const [p, v, t, e] = parts
  const prefix = dec(p)
  const version = dec(v)
  const typeRaw = dec(t)
  const type = normalizeType(typeRaw)
  const excelId = dec(e)
  const kind = excelIdKind(excelId)

  const valid =
    !!prefix &&
    isValidVersionLabel(version) &&
    isValidType(type) &&
    !!kind

  return {
    valid,
    prefix,
    version,
    type,          // 规范化后的类型：questionBank / envFull
    excelId,       // 规范化大写 ExcelID（若传入即为大写）
    excelIdKind: kind // 'card' | 'option'
  }
}

// -----------------------------
// Meta Key（非卡片/选项级数据，如 submode_instances 等）
// 形态：prefix:version:@meta:name
// 说明：不走 type(questionBank/envFull) 与 excelId 校验，避免与卡片数据冲突。
// -----------------------------
export function normalizeMetaName(name) {
  const s = String(name ?? '').trim()
  if (!s) throw new Error('meta name 不能为空')
  return s
}

export function buildMetaKey({ version, name, prefix }) {
  const p = String(prefix || SYSTEM_PREFIX).trim()
  if (!p) throw new Error('prefix 不能为空')

  const v = normalizeVersionLabel(version)
  if (!isValidVersionLabel(v)) throw new Error('版本号不能为空')

  const n = normalizeMetaName(name)
  return `${enc(p)}:${enc(v)}:${enc('@meta')}:${enc(n)}`
}

export function parseMetaKey(key) {
  const s = String(key || '')
  const parts = s.split(':')
  if (parts.length !== 4) return { valid: false }
  const [p, v, t, n] = parts
  const prefix = dec(p)
  const version = dec(v)
  const tag = dec(t)
  const name = dec(n)
  const valid =
    !!prefix &&
    isValidVersionLabel(version) &&
    tag === '@meta' &&
    !!name
  return { valid, prefix, version, name }
}

// -----------------------------
// 导出聚合对象（可选，便于“一个对象全用”）
// 你也可以只按需导入上面的任意函数。
// -----------------------------
export const ID = Object.freeze({
  // 系统前缀/版本/类型
  setSystemPrefix,
  getSystemPrefix,
  normalizeVersionLabel,
  isValidVersionLabel,
  TYPES,
  normalizeType,
  isValidType,

  // ExcelID（卡片/选项）
  isValidCardId,
  normalizeCardId,
  compareCardIds,
  generateNextCardId,
  isValidOptionId,
  normalizeOptionId,
  generateNextOptionId,
  buildFullOptionId,
  parseFullOptionId,
  compareFullOptionIds,

  // ExcelID 高层工具
  isCardExcelId,
  isOptionExcelId,
  isValidExcelId,
  excelIdKind,
  normalizeExcelId,
  buildExcelId,
  splitExcelId,

  // Key（固定四段）
  buildKey,
  parseKey,

  // Meta - 已添加到聚合对象中，无需单独导出
  buildMetaKey,
  parseMetaKey,
  normalizeMetaName
})
