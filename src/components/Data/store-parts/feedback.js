import { v4 as uuidv4 } from 'uuid'

export function submitForMatching(store, instanceId, results) {
  const invalidIds = results.filter(it => !store.isValidFullOptionId(it.optionId)).map(it => it.optionId)
  if (invalidIds.length > 0) {
    store.error = `以下选项ID不符合标准格式：${invalidIds.join(', ')}`
    return null
  }
  const submission = {
    id: `sub_${uuidv4()}`,
    instanceId,
    results,
    submittedAt: new Date().toISOString(),
    status: 'pending'
  }
  store.matchingFeedback.submissionHistory.push(submission)
  const feedback = store.dataManager.matchResultsWithQuestionBank(results, store.questionBank.questions)
  store.matchingFeedback.feedbackResults.push({
    ...feedback,
    submissionId: submission.id,
    generatedAt: new Date().toISOString()
  })
  submission.status = 'completed'
  store.dataManager.saveFeedbackData({
    submissions: store.matchingFeedback.submissionHistory,
    feedbacks: store.matchingFeedback.feedbackResults
  })
  return feedback
}