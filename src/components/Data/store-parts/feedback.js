// src/components/Data/store-parts/feedback.js
// 合并版：保留原有的 submitForMatching 与匹配/评分方法；
// 使用原生localStorage配合id.js进行存储操作

import { v4 as uuidv4 } from 'uuid';
import { buildMetaKey, ID } from '../services/id.js'; // 只导入需要的方法，移除buildKey和parseKey

// 使用id.js的元数据方法构建存储键（修复核心）
// 原错误：使用buildKey处理非ExcelID格式的标识
const STORAGE_KEY = buildMetaKey({
  version: 'V1',
  name: 'FEEDBACK_DATA' // 使用name参数存储自定义标识，无需遵循ExcelID格式
});

function isStorage(obj) {
  return obj && typeof obj.getItem === 'function' && typeof obj.setItem === 'function';
}

function resolveStorage(storageOrStore) {
  if (isStorage(storageOrStore)) return storageOrStore;
  if (storageOrStore && isStorage(storageOrStore.storage)) return storageOrStore.storage;
  if (storageOrStore?.dataManager?.longTermStorage) return storageOrStore.dataManager.longTermStorage;
  //  fallback到localStorage
  return localStorage;
}

function getJSON(storage, key) {
  if (!storage) return null;
  const val = storage.getItem(key);
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val || null;
}

function setJSON(storage, key, value) {
  if (!storage) return false;
  return storage.setItem(key, JSON.stringify(value));
}

/**
 * 提交匹配结果并处理反馈
 */
export function submitForMatching(store, instanceId, results) {
  // 验证选项ID格式（使用id.js中的方法）
  const invalidIds = (results || []).filter(it => !ID.isValidExcelId(it.optionId)).map(it => it.optionId);
  if (invalidIds.length > 0) {
    store.error = `以下选项ID不符合标准格式：${invalidIds.join(', ')}`;
    return null;
  }

  // 创建提交记录
  const submission = {
    id: `sub_${uuidv4()}`,
    instanceId,
    results,
    submittedAt: new Date().toISOString(),
    status: 'pending'
  };
  store.matchingFeedback.submissionHistory.push(submission);

  // 匹配题库并生成反馈
  const feedback = matchResultsWithQuestionBank(results, store.questionBank);
  store.matchingFeedback.feedbackResults.push({
    ...feedback,
    submissionId: submission.id,
    generatedAt: new Date().toISOString()
  });

  // 更新提交状态并保存反馈数据
  submission.status = 'completed';

  // 使用新的存储逻辑
  const s = resolveStorage(store);
  saveFeedbackData(s, {
    submissions: store.matchingFeedback.submissionHistory,
    feedbacks: store.matchingFeedback.feedbackResults
  });

  return feedback;
}

/**
 * 保存反馈数据到存储
 * @param {Object|Storage} storageOrStore - 存储对象或 store
 * @param {Object} feedbackData - 反馈数据
 * @returns {void}
 */
export function saveFeedbackData(storageOrStore, feedbackData) {
  const s = resolveStorage(storageOrStore);
  return setJSON(s, STORAGE_KEY, {
    ...feedbackData,
    updatedAt: new Date().toISOString()
  });
}

/**
 * 从存储加载反馈数据
 * @param {Object|Storage} storageOrStore - 存储对象或 store
 * @returns {Object} 反馈数据对象
 */
export function loadFeedbackData(storageOrStore) {
  const s = resolveStorage(storageOrStore);
  return getJSON(s, STORAGE_KEY) || {
    submissions: [],
    feedbacks: []
  };
}

/**
 * 将结果与题库匹配并生成反馈
 * @param {Array} results - 结果数组
 * @param {Object|Array} questionBank - 题库数据
 * @returns {Object} 匹配反馈结果
 */
export function matchResultsWithQuestionBank(results, questionBank) {
  const bank = Array.isArray(questionBank) ? questionBank : (questionBank?.questions || []);
  const feedback = {
    totalScore: 0,
    maxScore: 0,
    questionFeedbacks: [],
    passed: false
  };

  (results || []).forEach(result => {
    const question = bank.find(q => q.id === result.questionId);
    if (!question) {
      feedback.questionFeedbacks.push({
        questionId: result.questionId,
        found: false,
        message: '题目不存在于题库中'
      });
      return;
    }
    const qfb = evaluateQuestionResult(question, result);
    feedback.questionFeedbacks.push(qfb);
    feedback.totalScore += qfb.score;
    feedback.maxScore += qfb.maxScore;
  });

  feedback.passed = feedback.maxScore > 0
    ? (feedback.totalScore / feedback.maxScore) >= 0.6
    : false;

  return feedback;
}

/**
 * 评估单个题目的结果
 * @param {Object} question - 题目对象
 * @param {Object} result - 结果对象
 * @returns {Object} 题目反馈
 */
export function evaluateQuestionResult(question, result) {
  const feedback = {
    questionId: question.id,
    questionContent: question.content,
    userAnswer: result.answer,
    correctAnswer: question.correctAnswer,
    isCorrect: false,
    score: 0,
    maxScore: 0,
    explanation: '',
    ruleMatches: []
  };

  const rules = question.environmentConfig?.scoringRules || [];
  feedback.maxScore = rules.reduce((sum, r) => sum + (r.score || 0), 0);

  if (rules.length === 0) {
    feedback.isCorrect = result.answer === question.correctAnswer;
    feedback.score = feedback.isCorrect ? (feedback.maxScore || 10) : 0;
    feedback.explanation = feedback.isCorrect ? '回答正确' : '回答错误';
    return feedback;
  }

  rules.forEach(rule => {
    let ruleScore = 0;
    let matched = false;
    switch (rule.type) {
      case 'exact_match':
        matched = result.answer === question.correctAnswer;
        ruleScore = matched ? (rule.score || 0) : 0;
        break;
      case 'partial_match':
        if (typeof result.answer === 'string' && typeof question.correctAnswer === 'string') {
          matched = result.answer.includes(question.correctAnswer) ||
                    question.correctAnswer.includes(result.answer);
          ruleScore = matched ? (rule.score || 0) * 0.5 : 0;
        }
        break;
      case 'range_match':
        if (rule.parameters?.min !== undefined && rule.parameters?.max !== undefined) {
          const n = parseFloat(result.answer);
          if (!isNaN(n)) {
            matched = n >= rule.parameters.min && n <= rule.parameters.max;
            ruleScore = matched ? (rule.score || 0) : 0;
          }
        }
        break;
      default:
        matched = result.answer === question.correctAnswer;
        ruleScore = matched ? (rule.score || 0) : 0;
    }
    feedback.ruleMatches.push({ ruleId: rule.id, ruleName: rule.name, matched, score: ruleScore });
    feedback.score += ruleScore;
  });

  feedback.isCorrect = feedback.maxScore > 0 ? (feedback.score / feedback.maxScore) >= 0.8 : false;
  feedback.explanation = feedback.isCorrect ? '回答正确' : `回答不符合要求。正确答案：${question.correctAnswer}`;
  return feedback;
}
