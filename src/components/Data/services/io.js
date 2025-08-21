import { buildKey, TYPES, getSystemPrefix } from './id.js';
import { loadEnvironmentConfigs, saveEnvironmentConfigs } from '../store-parts/envConfigs';
import { loadLinkageRules, saveLinkageRules } from '../store-parts/linkage-new';

// 定义基础存储键的配置
const STORAGE_CONFIGS = {
  questionBank: {
    version: 'V1',
    type: TYPES.QUESTION_BANK,
    excelId: 'ROOT'
  },
  subModeInstances: {
    version: 'V1',
    type: TYPES.ENV_FULL,
    excelId: 'SUBMODES'
  },
  syncHistory: {
    version: 'V1',
    type: TYPES.ENV_FULL,
    excelId: 'SYNCHISTORY'
  }
};

// 生成存储键
function getStorageKey(config) {
  return buildKey({
    prefix: getSystemPrefix(),
    version: config.version,
    type: config.type,
    excelId: config.excelId
  });
}

// 确保使用正确的存储对象（现在直接使用localStorage）
function ensureStorage(storage) {
  if (storage && storage.getItem && storage.setItem) {
    return storage;
  }
  return window.localStorage;
}

export async function exportData(storage, { modeId = null, fileName = 'data_export.json' } = {}) {
  const s = ensureStorage(storage);

  // 使用新的键生成方式获取数据
  const exportData = {
    questionBank: JSON.parse(s.getItem(getStorageKey(STORAGE_CONFIGS.questionBank)) || '{"questions":[],"categories":[],"lastUpdated":null}'),
    environmentConfigs: await loadEnvironmentConfigs(s),
    linkageRules: loadLinkageRules(s),
    subModeInstances: JSON.parse(s.getItem(getStorageKey(STORAGE_CONFIGS.subModeInstances)) || '[]'),
    syncHistory: JSON.parse(s.getItem(getStorageKey(STORAGE_CONFIGS.syncHistory)) || '[]')
  };

  if (modeId && modeId !== 'root_admin') {
    exportData.subModeInstances = (exportData.subModeInstances || []).filter(inst => inst.baseModeId === modeId);
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return exportData;
}

export function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch {
        reject(new Error('无效的JSON文件'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

export async function importToLongTerm(storage, file, { modeId, namespace } = {}) {
  const s = ensureStorage(storage);
  try {
    const importedData = await importFromFile(file);

    // 题库合并
    if (importedData.questionBank) {
      const bankKey = getStorageKey(STORAGE_CONFIGS.questionBank);
      const existingBank = JSON.parse(s.getItem(bankKey) || '{"questions":[],"categories":[],"lastUpdated":null}');
      
      s.setItem(bankKey, JSON.stringify({
        ...existingBank,
        questions: [...(existingBank.questions || []), ...(importedData.questionBank.questions || [])],
        categories: Array.from(new Set([...(existingBank.categories || []), ...(importedData.questionBank.categories || [])])),
        lastUpdated: new Date().toISOString()
      }));
    }

    // 环境配置合并
    if (importedData.environmentConfigs) {
      const env = await loadEnvironmentConfigs(s);
      await saveEnvironmentConfigs(s, {
        ...env,
        uiPresets: [...(env.uiPresets || []), ...(importedData.environmentConfigs.uiPresets || [])],
        scoringRules: [...(env.scoringRules || []), ...(importedData.environmentConfigs.scoringRules || [])],
        contextTemplates: [...(env.contextTemplates || []), ...(importedData.environmentConfigs.contextTemplates || [])],
        linkageSettings: { ...(env.linkageSettings || {}), ...(importedData.environmentConfigs.linkageSettings || {}) }
      });
    }

    // 联动规则合并（按ID去重）
    if (Array.isArray(importedData.linkageRules)) {
      const existing = loadLinkageRules(s);
      const newOnes = importedData.linkageRules.filter(nr => !existing.some(ex => ex.id === nr.id));
      saveLinkageRules(s, [...existing, ...newOnes]);
    }

    return { success: true };
  } catch (err) {
    throw new Error(`导入失败: ${err.message}`);
  }
}
