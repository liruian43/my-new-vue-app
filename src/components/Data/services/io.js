// src/components/Data/services/io.js
import { LocalStorageStrategy } from '../storage/LocalStorageStrategy';
import { loadEnvironmentConfigs, saveEnvironmentConfigs } from '../store-parts/envConfigs';
import { loadLinkageRules, saveLinkageRules } from '../store-parts/linkage';

function ensureStorage(storage) {
  return storage && storage.prefix && typeof storage.getItem === 'function'
    ? storage
    : new LocalStorageStrategy();
}

export async function exportData(storage, { modeId = null, fileName = 'data_export.json' } = {}) {
  const s = ensureStorage(storage);

  const exportData = {
    questionBank: s.getItem('question_bank') || { questions: [], categories: [], lastUpdated: null },
    environmentConfigs: await loadEnvironmentConfigs(s),
    linkageRules: loadLinkageRules(s),
    subModeInstances: s.getItem('submode_instances') || [],
    syncHistory: s.getItem('sync_history') || []
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
      const bank = s.getItem('question_bank') || { questions: [], categories: [], lastUpdated: null };
      s.setItem('question_bank', {
        ...bank,
        questions: [...(bank.questions || []), ...(importedData.questionBank.questions || [])],
        categories: Array.from(new Set([...(bank.categories || []), ...(importedData.questionBank.categories || [])])),
        lastUpdated: new Date().toISOString()
      });
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