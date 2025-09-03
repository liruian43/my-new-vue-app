// src/components/Othermodes/answerSubmitter.js
// 统一的“答案提交”模块：仅负责收集、规范化并通过 DataManager 写入 LocalStorage（五段Key）

import { useCardStore } from '../Data/store'
import * as IdSvc from '../Data/services/id'

// 组装提交数据（与 SubMode 当前 UI 状态解耦）
export function buildSubmissionPayload({ modeId, modeName, version, cards }) {
  // 仅用于校验与归一输入，不把这些元信息写入 value
  IdSvc.normalizeModeId(modeId)
  IdSvc.normalizeVersionLabel(version)

  // 按用户要求：value 不存放多余元信息（不含 id/modeId/version/timestamp/submittedAt）
  return {
    modeName: String(modeName || ''),
    cards: (Array.isArray(cards) ? cards : []).map(card => ({
      id: card.id,
      title: card?.data?.title ?? card.title ?? '',
      selectedValue: card?.data?.selectedValue ?? card.selectedValue ?? null,
      options: Array.isArray(card?.data?.options)
        ? card.data.options.map(opt => ({
            id: opt.id,
            name: opt.name,
            value: opt.value,
            unit: opt.unit,
            checked: !!opt.checked
          }))
        : []
    }))
  }
}

// 提交（覆盖到 answers:main 的五段Key）
export async function submitAnswersOverwrite({ modeId, modeName, version, cards }) {
  const store = useCardStore()
  const mgr = store.dataManager
  if (!mgr) throw new Error('DataManager 未初始化')

  // 必须使用外部传入的版本，不做自动降级；若缺失则抛错，严格遵从五段Key
  if (!version) throw new Error('提交失败：缺少版本号（version）')

  const safeModeId = IdSvc.normalizeModeId(modeId)
  const safeVersion = IdSvc.normalizeVersionLabel(version)

  const payload = buildSubmissionPayload({ modeId: safeModeId, modeName, version: safeVersion, cards })
  await mgr.setAnswerSubmission(payload, { modeId: safeModeId, version: safeVersion })
  return true
}

// 兼容旧聚合接口（保留但不再推荐使用）
export async function submitAnswersAggregate({ modeId, modeName, version, cards }) {
  const store = useCardStore()
  const mgr = store.dataManager
  if (!mgr) throw new Error('DataManager 未初始化')

  const safeModeId = IdSvc.normalizeModeId(modeId)
  const effectiveVersion = version
    ? IdSvc.normalizeVersionLabel(version)
    : (typeof mgr.getVersionLabel === 'function' && mgr.getVersionLabel())
        || IdSvc.normalizeVersionLabel('v1.0.0')

  const payload = buildSubmissionPayload({ modeId: safeModeId, modeName, version: effectiveVersion, cards })
  // 为避免误用，聚合接口不再写入数组历史，这里也改为覆盖保存
  await mgr.setAnswerSubmission(payload, { modeId: safeModeId, version: effectiveVersion })
  return true
}