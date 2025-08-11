import { v4 as uuidv4 } from 'uuid';
import DataManager from '../manager';

export default {
  // root_admin特有的状态
  state: {
    rootMode: {
      id: 'root_admin',
      name: '根模式（源数据区）',
      level: 1,
      permissions: {
        card: { addCard: true, deleteCard: true, editTitle: true, editOptions: true },
        data: { view: true, save: true, export: true, import: true },
        mode: { create: true, delete: true, assignPermissions: true, sync: true },
        authorize: { canAuthorize: true }
      },
      cardData: []
    }
  },

  // root_admin特有的getters
  getters: {
    isRootMode(state, mainState) {
      return mainState.currentModeId === 'root_admin';
    },
    
    rootMediumData(mainState) {
      return mainState.mediumCards.filter(card => card.modeId === 'root_admin');
    }
  },

  // root_admin特有的actions
  actions: {
    // 初始化root模式数据
    initRootMode(state) {
      // 可以在这里添加root模式的初始化逻辑
    },

    // 只有root_admin能执行的同步操作
    syncToMode(state, mainState, mainActions, targetModeId, cardIds, syncConfig) {
      if (!targetModeId || targetModeId === 'root_admin') {
        mainState.error = '不能向主模式推送数据';
        return null;
      }
      
      if (!mainState.currentModeId === 'root_admin') {
        mainState.error = '只有主模式可以推送数据';
        return null;
      }
      
      const { syncFields = [], authFields = [] } = syncConfig || {};
      const validation = DataManager.validateConfig(mainState.sessionCards);
      
      if (!validation.pass) {
        mainState.error = '源数据校验失败，无法同步';
        return null;
      }
      
      const sourceCards = validation.validCards
        .filter(card => cardIds.includes(card.id))
        .map(card => {
          const titleSync = syncFields.includes(mainState.FIELD_IDS.CARD_TITLE);
          const titleAuth = authFields.includes(mainState.FIELD_IDS.CARD_TITLE);
          const nameSync = syncFields.includes(mainState.FIELD_IDS.OPTION_NAME);
          const nameAuth = authFields.includes(mainState.FIELD_IDS.OPTION_NAME);
          const valueSync = syncFields.includes(mainState.FIELD_IDS.OPTION_VALUE);
          const valueAuth = authFields.includes(mainState.FIELD_IDS.OPTION_VALUE);
          const unitSync = syncFields.includes(mainState.FIELD_IDS.OPTION_UNIT);
          const unitAuth = authFields.includes(mainState.FIELD_IDS.OPTION_UNIT);
          
          return mainActions.normalizeCardStructure({
            ...card,
            modeId: targetModeId,
            sourceModeId: 'root_admin',
            syncStatus: {
              title: { hasSync: titleSync, isAuthorized: titleAuth },
              options: {
                name: { hasSync: nameSync, isAuthorized: nameAuth },
                value: { hasSync: valueSync, isAuthorized: valueAuth },
                unit:  { hasSync: unitSync,  isAuthorized: unitAuth }
              },
              selectOptions: { hasSync: true, isAuthorized: false }
            },
            data: {
              ...card.data,
              title: titleSync ? card.data.title : null,
              options: card.data.options.map(option => ({
                ...option,
                name: nameSync ? option.name : null,
                value: valueSync ? option.value : null,
                unit: unitSync ? option.unit : null,
                localName: null,
                localValue: null,
                localUnit: null
              }))
            },
            syncTime: new Date().toISOString()
          });
        });

      const cardPresets = {};
      cardIds.forEach(id => {
        if (mainState.presetMappings[id]) {
          cardPresets[id] = mainState.presetMappings[id];
        }
      });

      if (sourceCards.length === 0) return null;

      const targetRawCards = mainState.sessionStorageEnhancer.load(targetModeId, 'cards') || [];
      const targetCards = [
        ...targetRawCards.filter(card => !cardIds.includes(card.id)),
        ...sourceCards
      ];
      
      mainState.sessionStorageEnhancer.save(targetModeId, 'cards', targetCards);

      if (mainState.currentModeId === targetModeId) {
        mainState.sessionCards = targetCards;
        Object.keys(cardPresets).forEach(cardId => {
          mainState.presetMappings[cardId] = cardPresets[cardId];
        });
        mainActions.savePresetMappings();
      }

      mainActions.updateModeSyncInfo(targetModeId, {
        lastSyncTime: new Date().toISOString(),
        syncFields,
        authFields,
        syncedCardIds: cardIds
      });

      return { targetModeId, syncedCount: sourceCards.length, syncFields, authFields };
    },

    // root_admin特有的权限控制方法
    toggleTitleEditingForRoot(state, mainState, cardId) {
      const tempIndex = mainState.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        mainState.tempCards[tempIndex].isTitleEditing = !mainState.tempCards[tempIndex].isTitleEditing;
        return;
      }
      
      const sessionIndex = mainState.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const card = mainState.sessionCards[sessionIndex];
        if (mainState.currentModeId === 'root_admin' || card.syncStatus.title.isAuthorized) {
          card.isTitleEditing = !card.isTitleEditing;
        }
      }
    },

    // 其他root_admin特有的方法...
  }
};
    