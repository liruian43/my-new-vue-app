// src/components/Data/manager.js
// 目标：保留题库与环境全量快照核心实现，其余功能“转发到新模块”（无损、兼容）。
// 后续可逐步从 store.js 直接调用新模块，然后删除这里的代理方法。
// 备注：标注了“可能需要删除/后期可合并”的功能点，仅注释提示，不做删除。

import { LocalStorageStrategy } from './storage/LocalStorageStrategy';
import { DataValidator } from './validators/dataValidator'; // [可能需要删除] 如果后续改为UI层校验，可移除

// 新模块引入
import * as Normalize from './store-parts/normalize';
import * as Cards from './store-parts/cards';
import * as EnvConfigs from './store-parts/envConfigs';
import * as Modes from './store-parts/modes';
import * as SubModes from './store-parts/subModes';
import * as Feedback from './store-parts/feedback';
import * as Sync from './store-parts/sync';
import * as Linkage from './store-parts/linkage';
import * as LongTerm from './services/longTerm';
import * as IdSvc from './services/id';
import * as IO from './services/io';
import { getNestedValue, setNestedValue } from './utils/objectPath';
import { generateTooltip } from './utils/uiTooltip'; // [可能需要删除] 若改到UI层则删除

export default class DataManager {
  constructor(storageStrategy) {
    this.longTermStorage = storageStrategy || new LocalStorageStrategy();
    this.validator = new DataValidator(); // [可能需要删除]
    this.rootAdminId = 'root_admin';
    this.currentModeId = this.rootAdminId;

    this.CARD_DATA_TEMPLATE = Cards.CARD_DATA_TEMPLATE;

    // 保留所有键名（历史兼容）
    this.storageKeys = {
      questionBank: 'question_bank',
      environmentConfigs: 'environment_configs',
      envFullSnapshots: 'env_full_snapshots',
      linkageRules: 'linkage_rules',
      subModeInstances: 'submode_instances',
      syncHistory: 'sync_history',
      fieldAuthorizations: 'field_authorizations',
      feedbackData: 'feedback_data',
      currentMode: 'current_mode',
      rootModeConfig: 'root_mode_config'
    };
  }

  // ========== 初始化（无损保留，后期可在 modes/env/linkage 初始化中拆分） ==========
  async initialize() {
    // 当前模式
    const savedMode = this.longTermStorage.getItem(this.storageKeys.currentMode);
    if (savedMode) this.currentModeId = savedMode;

    // 确保基础数据存在
    await this.loadQuestionBank();
    await EnvConfigs.loadEnvironmentConfigs(this.longTermStorage);
    await Linkage.loadLinkageRules(this.longTermStorage);
    await SubModes.loadSubModeInstances(this.longTermStorage);
    await this.loadEnvFullSnapshots();
  }

  // ========== 当前模式 ==========
  getCurrentModeId() {
    return this.currentModeId;
  }
  setCurrentMode(modeId) {
    this.currentModeId = modeId;
    this.longTermStorage.setItem(this.storageKeys.currentMode, modeId);
  }
  getMode(modeId) {
    return Modes.getMode(this.longTermStorage, modeId, this.rootAdminId);
  }

  // ========== 题库（保留） ==========
  async loadQuestionBank() {
    const bank = this.longTermStorage.getItem(this.storageKeys.questionBank) || {
      questions: [],
      categories: [],
      lastUpdated: null
    };
    return bank;
  }
  async saveQuestionBank(bankData) {
    return this.longTermStorage.setItem(this.storageKeys.questionBank, {
      ...bankData,
      lastUpdated: new Date().toISOString()
    });
  }
  normalizeQuestion(questionData) {
    return {
      id: questionData.id || `q_${Date.now()}`,
      content: Normalize.normalizeNullValue(questionData.content),
      explanation: Normalize.normalizeNullValue(questionData.explanation),
      categories: questionData.categories || [],
      difficulty: questionData.difficulty || 'medium',
      options: questionData.options || [],
      correctAnswer: Normalize.normalizeNullValue(questionData.correctAnswer),
      environmentConfig: questionData.environmentConfig || {
        uiConfig: {},
        scoringRules: [],
        timeLimit: null
      },
      createdAt: questionData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // ========== 环境全量快照（保留） ==========
  async loadEnvFullSnapshots() {
    const snaps = this.longTermStorage.getItem(this.storageKeys.envFullSnapshots) || [];
    return snaps.map(snap => ({
      version: snap.version || '',
      timestamp: snap.timestamp || Date.now(),
      hash: snap.hash || '',
      environment: snap.environment || {},
      fullConfigs: snap.fullConfigs || {}
    }));
  }
  async saveEnvFullSnapshots(snaps) {
    const validated = snaps.map(snap => ({
      version: snap.version || '',
      timestamp: snap.timestamp || Date.now(),
      hash: snap.hash || '',
      environment: snap.environment || {},
      fullConfigs: snap.fullConfigs || {}
    }));
    return this.longTermStorage.setItem(this.storageKeys.envFullSnapshots, validated);
  }

  // ========== 环境配置（迁出：envConfigs） ==========
  async loadEnvironmentConfigs() {
    return EnvConfigs.loadEnvironmentConfigs(this.longTermStorage);
  }
  saveEnvironmentConfigs(configs) {
    return EnvConfigs.saveEnvironmentConfigs(this.longTermStorage, configs);
  }
  createScoringRule(ruleData) {
    return EnvConfigs.createScoringRule(ruleData);
  }

  // ========== 联动（迁出：linkage） ==========
  loadLinkageRules() {
    return Linkage.loadLinkageRules(this.longTermStorage);
  }
  saveLinkageRules(rules) {
    // 使用轻量校验（内部已兜底），如需要完整校验可传入 this.validator
    return Linkage.saveLinkageRules(this.longTermStorage, rules, this.validator); // [可能需要删除] validator
  }
  createLinkageRule(ruleData) {
    return Linkage.createLinkageRule(ruleData, this.rootAdminId);
  }
  getLinkageRule(ruleId) {
    return Linkage.getLinkageRule(this.longTermStorage, ruleId);
  }
  deleteLinkageRule(ruleId) {
    return Linkage.deleteLinkageRule(this.longTermStorage, ruleId);
  }
  async executeLinkage(ruleId) {
    return Linkage.executeLinkage({
      storage: this.longTermStorage,
      rootAdminId: this.rootAdminId
    }, ruleId);
  }
  async executeReverseLinkage(rule) {
    return Linkage.executeReverseLinkage({
      storage: this.longTermStorage,
      rootAdminId: this.rootAdminId
    }, rule);
  }

  // ========== 同步（迁出：sync） ==========
  getSyncStatus(itemId) {
    return Sync.getSyncStatus(this.longTermStorage, itemId);
  }
  saveSyncHistory(history) {
    return Sync.saveSyncHistory(this.longTermStorage, history);
  }
  loadSyncHistory() {
    return Sync.loadSyncHistory(this.longTermStorage);
  }
  createSyncHistoryEntry(data) {
    return Sync.createSyncHistoryEntry(data);
  }
  updateSyncStatus(card, field) {
    return Sync.updateCardSyncStatus(card, field);
  }

  // 字段授权
  saveFieldAuthorizations(authorizations) {
    return Sync.saveFieldAuthorizations(this.longTermStorage, authorizations);
  }
  loadFieldAuthorizations() {
    return Sync.loadFieldAuthorizations(this.longTermStorage);
  }
  filterSyncFields(sourceData, authorizedFields) {
    return Sync.filterSyncFields(sourceData, authorizedFields);
  }

  // ========== 子模式（迁出：subModes/modes） ==========
  saveSubModeInstances(instances) {
    return SubModes.saveSubModeInstances(this.longTermStorage, instances);
  }
  loadSubModeInstances() {
    return SubModes.loadSubModeInstances(this.longTermStorage);
  }
  createSubModeSnapshot(sourceData) {
    return SubModes.createSubModeSnapshot(sourceData);
  }

  // 主模式配置 // [可能需要删除] 如无使用，可后续删除
  saveRootModeConfig(config) {
    return Modes.saveRootModeConfig(this.longTermStorage, config);
  }
  getRootModeConfig() {
    return Modes.getRootModeConfig(this.longTermStorage);
  }

  // ========== 反馈与评分（迁出：feedback） ==========
  saveFeedbackData(feedbackData) {
    return Feedback.saveFeedbackData(this.longTermStorage, feedbackData);
  }
  loadFeedbackData() {
    return Feedback.loadFeedbackData(this.longTermStorage);
  }
  matchResultsWithQuestionBank(results, questionBank) {
    return Feedback.matchResultsWithQuestionBank(results, questionBank);
  }
  evaluateQuestionResult(question, result) {
    return Feedback.evaluateQuestionResult(question, result);
  }

  // ========== 工具（迁出：normalize/cards/utils） ==========
  normalizeNullValue(value) {
    return Normalize.normalizeNullValue(value);
  }
  normalizeDataStructure(data, template) {
    return Normalize.normalizeDataStructure(data, template);
  }
  normalizeCardForStorage(card) {
    return Cards.normalizeCardForStorage(card);
  }
  generateTooltip(item) { // [可能需要删除] UI 辅助
    return generateTooltip(item);
  }
  getNestedValue(obj, path) {
    return getNestedValue(obj, path);
  }
  setNestedValue(obj, path, value) {
    return setNestedValue(obj, path, value);
  }

  // ========== 长期存储（迁出：services/longTerm） ==========
  saveToLongTerm(modeId, namespace, dataId, data) {
    return LongTerm.saveToLongTerm(this.longTermStorage, modeId, namespace, dataId, data, this.validator); // [可能需要删除] validator
  }
  getFromLongTerm(modeId, namespace, dataId) {
    return LongTerm.getFromLongTerm(this.longTermStorage, modeId, namespace, dataId);
  }
  deleteFromLongTerm(modeId, namespace, dataId) {
    return LongTerm.deleteFromLongTerm(this.longTermStorage, modeId, namespace, dataId);
  }
  clearLongTermByMode(modeId) {
    return LongTerm.clearLongTermByMode(this.longTermStorage, modeId, this.rootAdminId);
  }

  // ========== 导入导出（迁出：services/io） ==========
  async exportData(modeId = null, fileName = 'data_export.json') {
    return IO.exportData(this.longTermStorage, { modeId, fileName });
  }
  importFromFile(file) {
    return IO.importFromFile(file);
  }
  async importToLongTerm(file, modeId, namespace) {
    return IO.importToLongTerm(this.longTermStorage, file, { modeId, namespace });
  }

  // ========== ID（迁出：services/id） ==========
  compareCardIds(id1, id2) {
    return IdSvc.compareCardIds(id1, id2);
  }
  generateNextCardId(usedIds) {
    return IdSvc.generateNextCardId(usedIds);
  }
  generateNextOptionId(existingOptions) {
    return IdSvc.generateNextOptionId(existingOptions);
  }
  isValidCardId(id) {
    return IdSvc.isValidCardId(id);
  }
}