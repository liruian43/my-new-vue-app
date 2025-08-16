export async function loadQuestionBank(store) {
  const bankData = await store.dataManager.loadQuestionBank()
  const valid = bankData.questions?.filter(q => {
    if (!store.isQuestionExpressionValid(q.expression)) { console.warn(`题目 ${q.id} 表达式无效，跳过`); return false }
    const ids = q.expression.match(/[A-Z]+\d+/g) || []
    if (!ids.every(fid => !!store.getOptionByFullId(fid))) { console.warn(`题目 ${q.id} 引用不存在ID，跳过`); return false }
    return true
  }) || []
  store.questionBank = {
    questions: valid, categories: bankData.categories || [], lastUpdated: bankData.lastUpdated || new Date().toISOString()
  }
}

export function addQuestionToBank(store, questionData) {
  const expr = questionData.expression
  if (!store.isQuestionExpressionValid(expr)) {
    store.error = `题目表达式格式无效，必须符合 ${store.rootMode.dataStandards.questionExpressionPattern.toString()}`
    return false
  }
  const ids = expr.match(/[A-Z]+\d+/g) || []
  if (ids.length === 0) { store.error = '无法解析题目表达式中的ID'; return false }
  for (const fid of ids) {
    if (!store.getOptionByFullId(fid)) { store.error = `表达式中引用的选项 ${fid} 不存在`; return false }
  }
  const normalizedQuestion = store.dataManager.normalizeQuestion(questionData)
  const validation = store.dataManager.validator.validateQuestion(normalizedQuestion)
  if (!validation.pass) { store.error = `题目验证失败: ${validation.errors.join(', ')}`; return false }
  const idx = store.questionBank.questions.findIndex(q => q.id === normalizedQuestion.id)
  if (idx >= 0) store.questionBank.questions[idx] = normalizedQuestion
  else store.questionBank.questions.push(normalizedQuestion)
  store.questionBank.lastUpdated = new Date().toISOString()
  store.dataManager.saveQuestionBank(store.questionBank)
  return true
}

export function removeQuestionFromBank(store, questionId) {
  store.questionBank.questions = store.questionBank.questions.filter(q => q.id !== questionId)
  store.questionBank.lastUpdated = new Date().toISOString()
  store.dataManager.saveQuestionBank(store.questionBank)
  return true
}