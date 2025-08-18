// src/components/Data/store-parts/questions.js

// 简单字符串哈希（djb2）
function hashString(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i)
    h = h | 0
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8)
}

// A..Z, AA.. -> 序号（用于排序）
function lettersToIndex(letters) {
  let n = 0
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64)
  }
  return n
}

// 比较 'A1' / 'AA12' 这种 Excel ID（先列再行）
function compareFullOptionId(a, b) {
  const ma = String(a).match(/^([A-Z]+)(\d+)$/)
  const mb = String(b).match(/^([A-Z]+)(\d+)$/)
  if (!ma || !mb) return String(a).localeCompare(String(b))
  const [ , ca, ra ] = ma
  const [ , cb, rb ] = mb
  const ai = lettersToIndex(ca)
  const bi = lettersToIndex(cb)
  if (ai !== bi) return ai - bi
  return parseInt(ra, 10) - parseInt(rb, 10)
}

// 规范化“左侧表达式”：大写、去空格、过滤非法、去重并排序；输出 A1+B2+...
function canonicalizeLeft(input) {
  const s0 = String(input || '')
  // 允许使用全角箭头“→”，若没有箭头则视整个串为左侧
  const up = s0.toUpperCase().replace(/\s+/g, '')
  const left = up.includes('→') ? up.split('→')[0] : up
  if (!left) return ''
  const parts = left.split('+').filter(Boolean)
  const fullId = /^[A-Z]+\d+$/
  const tokens = parts.filter(t => fullId.test(t))
  const unique = Array.from(new Set(tokens))
  unique.sort(compareFullOptionId)
  return unique.join('+')
}

// 载入题库（兼容旧数据，并补充 left/key 字段）
export async function loadQuestionBank(store) {
  const bank = await store.dataManager.loadQuestionBank()
  const normalized = {
    questions: Array.isArray(bank?.questions) ? bank.questions : [],
    categories: bank?.categories || [],
    lastUpdated: bank?.lastUpdated || new Date().toISOString()
  }

  normalized.questions = normalized.questions.map(q => {
    // 拆 content（兼容旧数据）
    let content = q.content
    if (content == null) {
      const i = typeof q.expression === 'string' ? q.expression.indexOf('→') : -1
      content = i >= 0 ? q.expression.slice(i + 1) : ''
    }

    // 统一左侧表达式
    const rawLeft = typeof q.expression === 'string'
      ? q.expression.split('→')[0]
      : ''
    const left = canonicalizeLeft(rawLeft)
    const key = `${q.version || ''}|${left}`

    return {
      ...q,
      content,
      left,
      key
    }
  })

  store.questionBank = normalized
  return true
}

// 添加题库条目：唯一性 = 版本 + 规范化左侧表达式
// 仍保存完整 expression（A1+B2+…→内容），hash 仅作附加信息
export async function addQuestionToBank(store, payload) {
  const version = String(payload?.version || '').trim()
  let expressionInput = String(payload?.expression || '')
  const content = String(payload?.content || '') // 任意字符，原样保存
  const difficulty = payload?.difficulty || undefined

  if (!version) { store.error = '版本号不能为空'; return false }

  // 若传入 expression 以 “→” 结尾（或未包含“→”仅左侧），与 content 拼成完整表达式
  if (!expressionInput.includes('→') || expressionInput.endsWith('→')) {
    expressionInput = expressionInput.replace(/→?$/, '→') + content
  }
  expressionInput = expressionInput.trim()
  if (!expressionInput) { store.error = '题库表达式不能为空'; return false }

  // 规范出“左侧唯一串”
  const left = canonicalizeLeft(expressionInput.split('→')[0])
  if (!left) { store.error = '左侧表达式不能为空（至少一个 A1/B2...）'; return false }

  // 存库的完整表达式：用标准左侧 + 原 content
  const expression = `${left}→${content}`
  const qHash = hashString(`${version}|${expression}`)

  const bank = await store.dataManager.loadQuestionBank()
  const normalized = {
    questions: Array.isArray(bank?.questions) ? bank.questions : [],
    categories: bank?.categories || [],
    lastUpdated: bank?.lastUpdated || new Date().toISOString()
  }

  // 同一版本 + 同一规范化左侧 唯一
  const dupIdx = normalized.questions.findIndex(q => {
    if (q.version !== version) return false
    const qLeft = canonicalizeLeft(String(q?.expression || '').split('→')[0])
    return qLeft === left
  })
  if (dupIdx >= 0) {
    store.error = `该左侧表达式在版本「${version}」下已存在：${left}`
    return false
  }

  const q = {
    id: `q_${Date.now()}`,
    version,
    expression,  // 标准：A1+B2+…→内容
    content,     // 右侧内容，独立保存
    left,        // 规范化左侧（便于展示/检索）
    key: `${version}|${left}`, // 唯一键
    hash: qHash, // 附加信息
    difficulty,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  normalized.questions.push(q)
  normalized.lastUpdated = new Date().toISOString()

  await store.dataManager.saveQuestionBank(normalized)
  store.questionBank = normalized
  return true
}

export async function removeQuestionFromBank(store, questionId) {
  const bank = await store.dataManager.loadQuestionBank()
  const normalized = {
    questions: Array.isArray(bank?.questions) ? bank.questions : [],
    categories: bank?.categories || [],
    lastUpdated: bank?.lastUpdated || new Date().toISOString()
  }

  normalized.questions = normalized.questions.filter(q => q.id !== questionId)
  normalized.lastUpdated = new Date().toISOString()

  await store.dataManager.saveQuestionBank(normalized)
  store.questionBank = normalized
  return true
}