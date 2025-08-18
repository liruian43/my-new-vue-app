// src/components/Data/store-parts/envConfigs.js

// 工具函数
const _arr = (x) => Array.isArray(x) ? x : []

function stableStringify(obj) {
  const seen = new WeakSet()
  const recur = (v) => {
    if (v === null || typeof v !== 'object') return v
    if (seen.has(v)) return null
    seen.add(v)
    if (Array.isArray(v)) return v.map(recur)
    const keys = Object.keys(v).sort()
    const out = {}
    for (const k of keys) {
      const val = v[k]
      if (val === undefined) continue
      out[k] = recur(val)
    }
    return out
  }
  return JSON.stringify(recur(obj))
}

function hashString(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i)
    h = h | 0
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8)
}

// ========== 标准环境配置（保持与 store.js 的接口一致，提供最小可用实现） ==========

// 从存储加载环境配置（若 DataManager 未实现对应方法，则保持现状）
export async function loadEnvironmentConfigs(store) {
  if (typeof store.dataManager.loadEnvironmentConfigs === 'function') {
    const data = await store.dataManager.loadEnvironmentConfigs()
    if (data && typeof data === 'object') {
      store.environmentConfigs.cards = data.cards || {}
      store.environmentConfigs.options = data.options || {}
      store.environmentConfigs.uiPresets = _arr(data.uiPresets)
      store.environmentConfigs.scoringRules = _arr(data.scoringRules)
      store.environmentConfigs.contextTemplates = _arr(data.contextTemplates)
    }
  }
  return true
}

// 归一化 cards（数组 -> 映射）
export function normalizeCards(store, cards) {
  const out = {}
  for (const c of _arr(cards)) {
    const id = String(c?.id || '').trim()
    if (!id) continue
    out[id] = {
      id,
      title: c?.title ?? null,
      dropdown: _arr(c?.dropdown || c?.selectOptions).map(opt => (opt?.label ?? opt ?? null))
    }
  }
  return out
}

// 归一化 options（数组 -> A1 映射）
export function normalizeOptions(store, options) {
  const out = {}
  for (const o of _arr(options)) {
    const cardId = String(o?.cardId || o?.card || '').trim()
    const optId = String(o?.id || o?.optionId || '').trim()
    const fullId = String(o?.fullId || (cardId && optId ? `${cardId}${optId}` : '')).trim()
    if (!/^[A-Z]+$/.test(cardId) || !/^\d+$/.test(optId) || !/^[A-Z]+\d+$/.test(fullId)) continue
    out[fullId] = {
      name: o?.name ?? null,
      value: o?.value ?? null,
      unit: o?.unit ?? null
    }
  }
  return out
}

// 保存环境配置（若 DataManager 有实现则持久化）
export async function saveEnvironmentConfigs(store, configs = {}) {
  if (configs.cards) store.environmentConfigs.cards = configs.cards
  if (configs.options) store.environmentConfigs.options = configs.options
  if (configs.uiPresets) store.environmentConfigs.uiPresets = _arr(configs.uiPresets)
  if (configs.scoringRules) store.environmentConfigs.scoringRules = _arr(configs.scoringRules)
  if (configs.contextTemplates) store.environmentConfigs.contextTemplates = _arr(configs.contextTemplates)

  if (typeof store.dataManager.saveEnvironmentConfigs === 'function') {
    await store.dataManager.saveEnvironmentConfigs({
      cards: store.environmentConfigs.cards,
      options: store.environmentConfigs.options,
      uiPresets: store.environmentConfigs.uiPresets,
      scoringRules: store.environmentConfigs.scoringRules,
      contextTemplates: store.environmentConfigs.contextTemplates
    })
  }
  return true
}

// 读取某卡全部选项（A1/A2…展开）
export function getAllOptionsByCardId(store, cardId) {
  const res = []
  const map = store.environmentConfigs.options || {}
  const cid = String(cardId || '').trim()
  if (!cid) return res
  Object.entries(map).forEach(([fullId, opt]) => {
    if (fullId.startsWith(cid)) {
      res.push({
        id: fullId.replace(cid, ''),
        fullId,
        ...opt
      })
    }
  })
  return res
}

// 保存/获取题目上下文（保存在 environmentConfigs.contextTemplates 中）
export async function saveQuestionContext(store, questionId, contextData) {
  const qid = String(questionId || '').trim()
  if (!qid) return false
  const list = _arr(store.environmentConfigs.contextTemplates)
  const idx = list.findIndex(x => x?.questionId === qid)
  const record = { 
    questionId: qid, 
    content: contextData?.content ?? '', 
    createdAt: new Date().toISOString() 
  }
  if (idx >= 0) list[idx] = { ...list[idx], ...record }
  else list.push(record)
  store.environmentConfigs.contextTemplates = list
  await saveEnvironmentConfigs(store, { contextTemplates: list })
  return true
}

export function getQuestionContext(store, questionId) {
  const qid = String(questionId || '').trim()
  const list = _arr(store.environmentConfigs.contextTemplates)
  return list.find(x => x?.questionId === qid) || null
}

// 环境变更通知（兜底）
export function notifyEnvConfigChanged(/* store */) {
  return true
}

// ========== 全量快照 ==========

// 仅从 sessionCards 构建“全量环境数据”
// 强制：卡片按 Excel 字母顺序排序；选项编号 1..N
function buildEnvironmentFromSession(store) {
  const env = { cards: {}, options: {} }
  const cards = _arr(store.sessionCards)
    .slice()
    .sort((a, b) => {
      if (typeof store.compareCardIds === 'function') return store.compareCardIds(a.id, b.id)
      return String(a.id).localeCompare(String(b.id))
    })

  for (const card of cards) {
    const cardId = String(card.id)
    if (!/^[A-Z]+$/.test(cardId)) continue

    env.cards[cardId] = {
      id: cardId,
      title: card?.data?.title ?? null,
      dropdown: _arr(card?.data?.selectOptions).map(opt => (opt?.label ?? null))
    }

    const opts = _arr(card?.data?.options)
    opts.forEach((opt, idx) => {
      const optionId = String(idx + 1) // 1..N
      const combinedId = `${cardId}${optionId}`
      env.options[combinedId] = {
        name: opt?.name ?? null,
        value: opt?.value ?? null,
        unit: opt?.unit ?? null
      }
    })
  }
  return env
}

// 从 environment 构建 fullConfigs（A1 为键）
function buildFullConfigs(env) {
  const full = {}
  const cards = env.cards || {}
  const options = env.options || {}

  Object.keys(options).forEach(combinedId => {
    const m = combinedId.match(/^([A-Z]+)(\d+)$/)
    if (!m) return
    const cardId = m[1]
    const optionId = m[2]
    const c = cards[cardId] || {}
    const o = options[combinedId] || {}

    full[combinedId] = {
      combinedId,
      cardId,
      optionId,
      configTitle: c.title ?? null,
      optionName: o.name ?? null,
      optionValue: o.value ?? null,
      optionUnit: o.unit ?? null,
      dropdownFlag: false
    }
  })

  return full
}

// 列出全量快照（仅元信息）
export async function listEnvFullSnapshots(store) {
  const snaps = await store.dataManager.loadEnvFullSnapshots()
  const arr = Array.isArray(snaps) ? snaps : []
  return arr.map(s => ({ 
    version: s.version, 
    timestamp: s.timestamp, 
    hash: s.hash 
  }))
}

// 保存全量快照（禁止重名；仅抓 sessionCards；附带 hash）
export async function saveEnvFullSnapshot(store, versionLabel) {
  const version = String(versionLabel || '').trim()
  if (!version) {
    store.error = '版本号不能为空'
    return false
  }

  const snaps = await store.dataManager.loadEnvFullSnapshots()
  const arr = Array.isArray(snaps) ? snaps : []

  if (arr.some(s => s.version === version)) {
    store.error = `版本号已存在：${version}`
    return false
  }

  const environment = buildEnvironmentFromSession(store)
  const fullConfigs = buildFullConfigs(environment)
  const hash = hashString(stableStringify(fullConfigs))

  const snap = {
    version,
    timestamp: Date.now(),
    hash,
    environment,
    fullConfigs
  }

  arr.push(snap)
  await store.dataManager.saveEnvFullSnapshots(arr)
  return true
}

// 加载版本并恢复到“操作台”（覆盖式、且从 A 开始、选项 1..N、编辑默认关闭）
export async function applyEnvFullSnapshot(store, versionLabel) {
  const version = String(versionLabel || '').trim()
  if (!version) return false

  const snaps = await store.dataManager.loadEnvFullSnapshots()
  const arr = Array.isArray(snaps) ? snaps : []
  const snap = arr.find(s => s.version === version)
  if (!snap) {
    store.error = `未找到版本：${version}`
    return false
  }

  const env = snap.environment || { cards: {}, options: {} }

  // 按 Excel 字母顺序取卡片 id
  const cardIds = Object.keys(env.cards || {}).sort((a, b) => {
    if (typeof store.compareCardIds === 'function') return store.compareCardIds(a, b)
    return String(a).localeCompare(String(b))
  })

  // 转换为 replaceSessionWithCards 可接受的“简卡结构”
  const incomingCards = cardIds.map(cardId => {
    const c = env.cards[cardId] || {}

    // 下拉项：按原顺序生成 label 列表（id 无所谓，replace 会重排）
    const selectOptions = Array.isArray(c.dropdown)
      ? c.dropdown.map((label, idx) => ({ id: idx + 1, label }))
      : []

    // 选项：从 options 映射中过滤 A1/A2…，按数字排序，随后 replace 会重排为 1..N
    const optionEntries = Object.entries(env.options || {})
      .filter(([fullId]) => fullId.startsWith(cardId))
      .map(([fullId, o]) => {
        const m = fullId.match(/\d+$/)
        const numId = m ? parseInt(m[0], 10) : null
        return { 
          numId, 
          name: o?.name ?? null, 
          value: o?.value ?? null, 
          unit: o?.unit ?? null 
        }
      })
      .filter(o => o.numId !== null)
      .sort((a, b) => a.numId - b.numId)
      .map((o, idx) => ({
        id: idx + 1,
        name: o.name,
        value: o.value,
        unit: o.unit,
        checked: false
      }))

    return {
      id: cardId, // 传入 id 仅作展示；replace 会重新从 A 排号
      data: {
        title: c.title ?? null,
        options: optionEntries,
        selectOptions,
        selectedValue: null
      }
    }
  })

  // 核心：覆盖到操作台，并让卡片从 A 开始、选项 1..N、编辑默认关闭
  if (typeof store.replaceSessionWithCards === 'function') {
    store.replaceSessionWithCards(incomingCards, { editMode: 'none' })
  } else {
    // 兜底：若还未集成 replaceSessionWithCards，退回到旧逻辑（不推荐）
    // 直接设置 environment 到 store（旧行为）
    store.environmentConfigs.cards = env.cards || {}
    store.environmentConfigs.options = env.options || {}

    // 重建 sessionCards（尽量贴近 replace 的结果）
    const sessionCards = []
    for (const cardId of cardIds) {
      const c = env.cards[cardId] || {}
      const selectOptions = Array.isArray(c.dropdown)
        ? c.dropdown.map((label, idx) => ({ id: idx + 1, label }))
        : []
      const optionEntries = Object.entries(env.options || {})
        .filter(([fullId]) => fullId.startsWith(cardId))
        .map(([fullId, o]) => {
          const m = fullId.match(/\d+$/)
          const numId = m ? parseInt(m[0], 10) : null
          return { 
            numId, 
            name: o?.name ?? null, 
            value: o?.value ?? null, 
            unit: o?.unit ?? null 
          }
        })
        .filter(o => o.numId !== null)
        .sort((a, b) => a.numId - b.numId)
        .map((o, idx) => ({
          id: idx + 1,
          name: o.name,
          value: o.value,
          unit: o.unit,
          checked: false
        }))

      sessionCards.push({
        id: cardId,
        modeId: store.currentModeId || 'root_admin',
        data: {
          title: c.title ?? null,
          options: optionEntries,
          selectOptions,
          selectedValue: null
        },
        editableFields: {
          optionName: false,
          optionValue: false,
          optionUnit: false,
          optionCheckbox: false,
          optionActions: false,
          select: false
        },
        showDropdown: false,
        isTitleEditing: false,
        isOptionsEditing: false,
        isSelectEditing: false,
        isPresetEditing: false
      })
    }
    store.tempCards = []
    store.sessionCards = sessionCards
    store.selectedCardId = sessionCards[0]?.id || null
  }

  store.error = null
  return true
}