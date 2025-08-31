// 新增
import { Serialization } from './Data/store-parts/serialization.js'

export function sortExcelIds(ids = [], IdSvc) {
try {
if (typeof IdSvc?.compareFullOptionIds === 'function') {
return [...ids].sort((a, b) => IdSvc.compareFullOptionIds(a, b))
}
} catch {}
// 兜底排序：先按字母，后按数字
return [...ids].sort((a, b) => {
const am = String(a).match(/^([A-Z]+)(\d+)$/)
const bm = String(b).match(/^([A-Z]+)(\d+)$/)
if (am && bm) {
const c = am[1].localeCompare(bm[1])
return c !== 0 ? c : (parseInt(am[2], 10) - parseInt(bm[2], 10))
}
return String(a).localeCompare(String(b))
})
}

export function buildDefaultPermissions(excelIds = []) {
const obj = {}
excelIds.forEach(id => {
obj[id] = {
name: { sync: false, auth: false },
value: { sync: false, auth: false },
unit: { sync: false, auth: false }
}
})
return obj
}

export function mergePermissions(currentIds = [], saved = {}) {
const merged = {}
currentIds.forEach(id => {
if (saved && saved[id]) {
merged[id] = saved[id]
} else {
merged[id] = {
name: { sync: false, auth: false },
value: { sync: false, auth: false },
unit: { sync: false, auth: false }
}
}
})
return merged
}

export function tamperEnvFullByPermissions(originalData, permissions, fieldLabels) {
try {
const parsedData = JSON.parse(originalData)


// 环境快照模式（含 fullConfigs）
if (parsedData.fullConfigs && typeof parsedData.fullConfigs === 'object') {
  const modifiedData = JSON.parse(JSON.stringify(parsedData))
  const tamperReport = []

  // 处理 fullConfigs
  Object.keys(parsedData.fullConfigs).forEach(currentExcelId => {
    const excelPerm = permissions[currentExcelId]
    const handleField = (fieldType) => {
      const label = fieldLabels[fieldType] || fieldType
      let prop = null
      switch (fieldType) {
        case 'name': prop = 'optionName'; break
        case 'value': prop = 'optionValue'; break
        case 'unit': prop = 'optionUnit'; break
      }
      if (!prop) return
      if (excelPerm && excelPerm[fieldType]) {
        const { sync, auth } = excelPerm[fieldType]
        if (!sync) {
          if (modifiedData.fullConfigs[currentExcelId][prop] !== undefined) {
            modifiedData.fullConfigs[currentExcelId][prop] = null
            tamperReport.push(`${currentExcelId}.${label}: 克制为null (未同步)`)
          }
        } else {
          tamperReport.push(`${currentExcelId}.${label}: 同步+${auth ? '可编辑' : '只读'}`)
        }
      } else {
        if (modifiedData.fullConfigs[currentExcelId][prop] !== undefined) {
          modifiedData.fullConfigs[currentExcelId][prop] = null
          tamperReport.push(`${currentExcelId}.${label}: 克制为null (无权限配置)`)
        }
      }
    }
    ;['name', 'value', 'unit'].forEach(handleField)
  })

  // 同步更新 environment.options
  if (modifiedData.environment && modifiedData.environment.options) {
    Object.keys(modifiedData.environment.options).forEach(optionId => {
      const excelPerm = permissions[optionId]
      if (!excelPerm) return
      const optionData = modifiedData.environment.options[optionId]
      ;['name', 'value', 'unit'].forEach(fieldType => {
        if (!excelPerm[fieldType]?.sync && optionData[fieldType] !== undefined) {
          optionData[fieldType] = null
        }
      })
    })
  }

  return { modifiedData: JSON.stringify(modifiedData), tamperReport }
}

// 单条数据模式兜底（基本不会用到）
const modifiedData = { ...parsedData }
const tamperReport = []
const currentExcelId = 'UNKNOWN'
;['name', 'value', 'unit'].forEach(fieldType => {
  const label = fieldLabels[fieldType] || fieldType
  const excelPerm = permissions[currentExcelId]?.[fieldType]
  if (!excelPerm?.sync) {
    if (modifiedData[fieldType] !== undefined) {
      modifiedData[fieldType] = null
      tamperReport.push(`${label}: 克制为null (未同步)`)
    }
  } else {
    tamperReport.push(`${label}: 同步+${excelPerm.auth ? '可编辑' : '只读'}`)
  }
})
return { modifiedData: JSON.stringify(modifiedData), tamperReport }
} catch (e) {
return { modifiedData: originalData, tamperReport: ['数据解析失败，未进行篡改'] }
}
}

export function generatePermissionSummary(permissions) {
const summary = {
totalExcelIds: Object.keys(permissions || {}).length,
syncCount: 0,
authCount: 0,
details: {}
}
Object.entries(permissions || {}).forEach(([excelId, p]) => {
const excelSummary = { syncFields: [], authFields: [], readOnlyFields: [], hiddenFields: [] }
;['name', 'value', 'unit'].forEach(field => {
const perm = p[field] || { sync: false, auth: false }
if (perm.sync && perm.auth) {
excelSummary.syncFields.push(field)
summary.authCount++
} else if (perm.sync && !perm.auth) {
excelSummary.readOnlyFields.push(field)
} else {
excelSummary.hiddenFields.push(field)
}
if (perm.sync) summary.syncCount++
})
summary.details[excelId] = excelSummary
})
return summary
}

export function ensureEnvFullUniqueness(targetMode, IdSvc) {
const isRoot = targetMode === IdSvc.ROOT_ADMIN_MODE_ID
if (isRoot) return { deleted: 0, isRootAdmin: true }
const deleted = IdSvc.batchKeyOperation('delete', { modeId: targetMode, type: 'envFull' })
return { deleted, isRootAdmin: false }
}

export function fetchRootEnvFullSnapshotItem(IdSvc, version) {
const list = IdSvc.batchKeyOperation('export', {
modeId: IdSvc.ROOT_ADMIN_MODE_ID,
version,
type: 'envFull',
excelId: 'A0'
})
return Array.isArray(list) && list.length > 0 ? list[0] : null
}

// 新增：通过 serialization.js 读取 root_admin + 版本 的 envFull:A0 快照
export function loadRootEnvFullSnapshotWithSerialization(storeOrCtx, IdSvc, versionLabel) {
  const storage = Serialization._internal.resolveStorage(storeOrCtx) || (typeof window !== 'undefined' ? window.localStorage : null)
  const key = Serialization._internal.storageKeyForEnv({
    currentModeId: IdSvc.ROOT_ADMIN_MODE_ID,
    currentVersion: versionLabel
  })
  return Serialization._internal.getJSON(storage, key)
}

// 新增：写入目标模式 + 版本 的唯一一条 envFull:A0 快照
export function writeTargetEnvFullSnapshotWithSerialization(storeOrCtx, targetModeId, versionLabel, snapshotObj) {
  const storage = Serialization._internal.resolveStorage(storeOrCtx) || (typeof window !== 'undefined' ? window.localStorage : null)
  const key = Serialization._internal.storageKeyForEnv({
    currentModeId: targetModeId,
    currentVersion: versionLabel
  })
  return Serialization._internal.setJSON(storage, key, snapshotObj)
}

// 新增：仅依据 sync 置空 environment.options 的 name/value/unit；授权不影响数据层
export function maskEnvBySyncOnly(snapshotObj, permissions) {
  if (!snapshotObj || typeof snapshotObj !== 'object') return snapshotObj
  const cloned = JSON.parse(JSON.stringify(snapshotObj))
  const env = cloned.environment || {}
  env.options = env.options || {}
  Object.keys(env.options).forEach(fullId => {
    const excelPerm = permissions?.[fullId]
    if (!excelPerm) {
      // 默认不同步：置空三字段
      if ('name'  in env.options[fullId]) env.options[fullId].name  = null
      if ('value' in env.options[fullId]) env.options[fullId].value = null
      if ('unit'  in env.options[fullId]) env.options[fullId].unit  = null
      return
    }
    ;['name','value','unit'].forEach(f => {
      const p = excelPerm[f]
      if (p && p.sync === false && f in env.options[fullId]) {
        env.options[fullId][f] = null
      }
    })
  })
  // 兼容：如存在 fullConfigs，则把结果回写到旧字段名
  if (cloned.fullConfigs && typeof cloned.fullConfigs === 'object') {
    Object.keys(cloned.fullConfigs).forEach(fullId => {
      const src = env.options[fullId]
      const rec = cloned.fullConfigs[fullId]
      if (!src || !rec) return
      if ('optionName'  in rec) rec.optionName  = src.name  ?? null
      if ('optionValue' in rec) rec.optionValue = src.value ?? null
      if ('optionUnit'  in rec) rec.optionUnit  = src.unit  ?? null
    })
  }
  return cloned
}

// 新增：从快照中提取 ExcelID 列表，并用已有排序规则排序
export function extractExcelIdsFromSnapshot(snapshotObj, IdSvc) {
  const envOptions = snapshotObj?.environment?.options || {}
  const ids = Object.keys(envOptions)
  return sortExcelIds(ids, IdSvc)
}
