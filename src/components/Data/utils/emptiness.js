// 0 和 false 有意义，不算空
export function isEmptyPrimitive(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  return false
}

// 存储前：空白→null，避免 undefined 落盘
export function toNull(v) {
  if (v === 0 || v === false) return v
  if (v === undefined || v === null) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}

// UI 显示：null/undefined→""（只用于显示，不回写存储）
export function toDisplay(v) {
  return v === null || v === undefined ? '' : String(v)
}

// 选项内容是否“全空”（不包含结构判断）
export function isOptionContentEmpty(opt) {
  const nameEmpty  = isEmptyPrimitive(opt?.name)
  const valueEmpty = isEmptyPrimitive(opt?.value)
  const unitEmpty  = isEmptyPrimitive(opt?.unit)
  return nameEmpty && valueEmpty && unitEmpty
}

// 形状（shape）补齐：卡片/选项/环境
// 注意：这里不负责 ID 合法化，也不默认成 'A'，ID 规范交给 id.js
export function ensureCardShape(raw) {
  const id = String(raw?.id ?? '').trim()
  const title = toNull(raw?.title)
  const dropdownSrc = Array.isArray(raw?.dropdown) ? raw.dropdown : []
  const dropdown = dropdownSrc.map(x => String(x ?? '')) // 空项可存为 ''
  return { id, title, dropdown }
}

export function ensureOptionShape(raw) {
  return {
    name: toNull(raw?.name),
    value: toNull(raw?.value),
    unit: toNull(raw?.unit)
  }
}

export function ensureEnvironmentShape(raw) {
  const out = { cards: {}, options: {} }
  const cards = raw && typeof raw.cards === 'object' ? raw.cards : {}
  const options = raw && typeof raw.options === 'object' ? raw.options : {}

  for (const [cardId, card] of Object.entries(cards)) {
    out.cards[String(cardId).trim().toUpperCase()] = ensureCardShape({ id: cardId, ...card })
  }
  for (const [fullId, opt] of Object.entries(options)) {
    out.options[String(fullId).trim().toUpperCase()] = ensureOptionShape(opt)
  }
  return out
}

// 结构存在性（不看内容是否为空）
export function hasCardStructInEnv(env) {
  return Object.keys(env?.cards || {}).length > 0
}
export function hasOptionStructInEnv(env) {
  return Object.keys(env?.options || {}).length > 0
}
export function hasAtLeastOneCardAndOptionInEnv(env) {
  return hasCardStructInEnv(env) && hasOptionStructInEnv(env)
}

// 运行态（session）结构存在性
export function hasCardStructInSession(store) {
  return Array.isArray(store?.sessionCards) && store.sessionCards.length > 0
}
export function hasOptionStructInSession(store) {
  if (!Array.isArray(store?.sessionCards)) return false
  return store.sessionCards.some(c => Array.isArray(c?.data?.options) && c.data.options.length > 0)
}
export function hasAtLeastOneCardAndOptionInSession(store) {
  return hasCardStructInSession(store) && hasOptionStructInSession(store)
}