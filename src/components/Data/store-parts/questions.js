// src/components/Data/store-parts/questions.js

// 导入ID规则中心提供的工具函数，特别是 ROOT_ADMIN_MODE_ID 常量
import {
  isOptionExcelId,
  normalizeExcelId,
  compareFullOptionIds,
  ROOT_ADMIN_MODE_ID // 导入 ROOT_ADMIN_MODE_ID
} from '../services/id.js'

// 简单字符串哈希（djb2）
function hashString(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i)
    h = h | 0
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8)
}

// 规范化“左侧表达式”：大写、去空格、过滤非法、去重并排序；输出 A1+B2+...
function canonicalizeLeft(input) {
  const s0 = String(input || '')
  // 允许使用全角箭头“→”，若没有箭头则视整个串为左侧
  const up = s0.toUpperCase().replace(/\s+/g, '')
  const left = up.includes('→') ? up.split('→')[0] : up
  if (!left) return ''
  const parts = left.split('+').filter(Boolean)

  // 仅接受“选项级”ExcelID（如 A6、AA12），用中心规则校验与规范化
  const tokens = parts
    .map(t => t.trim())
    .filter(t => isOptionExcelId(t))   // 只要字母+数字
    .map(normalizeExcelId)             // 统一成大写规范形式（如 a6 -> A6）

  // 去重 + 统一排序
  const unique = Array.from(new Set(tokens))
  unique.sort(compareFullOptionIds)    // 先按列（A..Z..AA..），再按行（数字）

  return unique.join('+')
}

// 载入题库（兼容旧数据，并补充 modeId, left, key, hash 字段）
export async function loadQuestionBank(store) {
  // dataManager.loadQuestionBank 预期会接收 modeId，并在内部按 modeId 从长期存储加载题库
  const bank = await store.dataManager.loadQuestionBank(store.currentModeId)
  const normalized = {
    questions: Array.isArray(bank?.questions) ? bank.questions : [],
    categories: bank?.categories || [],
    lastUpdated: bank?.lastUpdated || new Date().toISOString()
  }

  // 确保所有题库条目都有 modeId ，并更新其 key 和 hash
  normalized.questions = normalized.questions.map(q => {
    // 兼容旧数据：如果缺少 modeId，则默认为当前模式ID
    // 注意：这将把旧数据“归属”到当前加载的模式下。未来多模式上线后，
    // 旧的 root_admin 数据需要被明确标记为 ROOT_ADMIN_MODE_ID
    const questionModeId = q.modeId || store.currentModeId || ROOT_ADMIN_MODE_ID;

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

    // 新的 key 应该包含 modeId，以确保在特定模式下的唯一性识别
    const key = `${questionModeId}|${q.version || ''}|${left}`
    // 新的 hash 也应该包含 modeId，以确保其在全局的唯一性计算
    const qHash = hashString(`${questionModeId}|${q.version || ''}|${q.expression || ''}`)


    return {
      ...q,
      modeId: questionModeId, // 确保有 modeId 字段
      content,
      left,
      key, // 更新 key 字段
      hash: qHash // 更新 hash 字段
    }
  })

  store.questionBank = normalized
  return true
}

// 添加题库条目：唯一性 = modeId + 版本 + 规范化左侧表达式
// 仍保存完整 expression（A1+B2+…→内容），hash 仅作附加信息
export async function addQuestionToBank(store, payload) {
  const modeId = store.currentModeId || ROOT_ADMIN_MODE_ID; // 获取当前模式ID，用于将问题归属到该模式
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

  // 存在题库的完整表达式：用标准左侧 + 原 content
  const expression = `${left}→${content}`
  // qHash 的计算也应该包含 modeId，确保全局唯一性
  const qHash = hashString(`${modeId}|${version}|${expression}`)

  // dataManager.loadQuestionBank 预期会接收 modeId，并在内部按 modeId 从长期存储加载题库
  const bank = await store.dataManager.loadQuestionBank(modeId)
  const normalized = {
    questions: Array.isArray(bank?.questions) ? bank.questions : [],
    categories: bank?.categories || [],
    lastUpdated: bank?.lastUpdated || new Date().toISOString()
  }

  // ==== 核心唯一性检查：在同一模式ID、同一版本、同一规范化左侧下，题库条目应唯一 ====
  const dupIdx = normalized.questions.findIndex(q => {
    // 首先检查 modeId 是否匹配
    if (q.modeId !== modeId) return false;
    // 其次检查版本是否匹配
    if (q.version !== version) return false;
    // 最后检查规范化左侧表达式是否匹配
    const qLeft = canonicalizeLeft(String(q?.expression || '').split('→')[0]);
    return qLeft === left;
  })
  if (dupIdx >= 0) {
    store.error = `该左侧表达式在模式「${modeId}」下，版本「${version}」已存在：${left}`;
    return false;
  }

  const q = {
    id: `q_${Date.now()}`,
    modeId: modeId,      // <--- 关键：在题库条目中显式存储 modeId
    version,
    expression,  // 标准：A1+B2+…→内容
    content,     // 右侧内容，独立保存
    left,        // 规范化左侧（便于展示/检索）
    key: `${modeId}|${version}|${left}`, // <--- 关键：内部唯一键包含 modeId
    hash: qHash, // 附加信息，也包含 modeId 信息
    difficulty,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  normalized.questions.push(q)
  normalized.lastUpdated = new Date().toISOString()

  // dataManager.saveQuestionBank 预期会接收 modeId，并在内部按 modeId 保存题库
  await store.dataManager.saveQuestionBank(normalized, modeId)
  store.questionBank = normalized
  return true
}

export async function removeQuestionFromBank(store, questionId) {
  const modeId = store.currentModeId || ROOT_ADMIN_MODE_ID; // 获取当前模式ID
  // dataManager.loadQuestionBank 预期会接收 modeId
  const bank = await store.dataManager.loadQuestionBank(modeId)
  const normalized = {
    questions: Array.isArray(bank?.questions) ? bank.questions : [],
    categories: bank?.categories || [],
    lastUpdated: bank?.lastUpdated || new Date().toISOString()
  }
  
  // 过滤时：确保删除的是当前模式下，且 questionId 匹配的条目
  normalized.questions = normalized.questions.filter(q => q.id !== questionId && q.modeId === modeId) 
  normalized.lastUpdated = new Date().toISOString()

  // dataManager.saveQuestionBank 预期会接收 modeId
  await store.dataManager.saveQuestionBank(normalized, modeId)
  store.questionBank = normalized
  return true
}