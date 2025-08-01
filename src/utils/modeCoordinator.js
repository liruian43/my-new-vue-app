import { useCardStore } from '../components/Data/store'; 
import DataManager from '../components/Data/manager';

// 获取模式的工具函数
const getMode = (cardStore, modeId) => {
  if (modeId === 'root_admin') {
    return cardStore.rootMode;
  }
  return cardStore.modes.find(mode => mode.id === modeId) || null;
};

// 校验同步权限（只有root_admin可作为源）
export const checkSyncPermission = (sourceModeId, targetModeId) => {
  const cardStore = useCardStore();
  
  // 强制只有root_admin可以作为数据源
  if (sourceModeId !== 'root_admin') {
    console.warn('只有root_admin可以作为数据源');
    return false;
  }
  
  // 不能同步到自己
  if (sourceModeId === targetModeId) {
    console.warn('不能同步到自身模式');
    return false;
  }
  
  const targetMode = getMode(cardStore, targetModeId);
  if (!targetMode) {
    console.warn(`目标模式${targetModeId}不存在`);
    return false;
  }
  
  return true;
};

// 辅助函数：处理空值和"null"字符串（只处理空值，不过滤字段）
const processValue = (value) => {
  // 空字符串/undefined统一转为null（保持字段存在）
  if (value === '' || value === undefined) {
    return null;
  }
  // 禁止直接输入"null"字符串（避免与空值标识冲突）
  if (typeof value === 'string' && value.trim().toLowerCase() === 'null') {
    throw new Error('不允许输入"null"字符串，请留空表示空值');
  }
  return value; // 有内容则保留原始值
};

export const coordinateMode = (linkageConfig) => {
  const { 
    sourceModeId, 
    sourceData, 
    targetModeIds, 
    syncFields, 
    authFields 
  } = linkageConfig;
  
  const cardStore = useCardStore();
  const dataManager = new DataManager(cardStore.storageStrategy);
  
  if (sourceModeId !== 'root_admin') {
    throw new Error('只有root_admin可以作为同步源');
  }
  
  targetModeIds.forEach(targetId => {
    if (checkSyncPermission(sourceModeId, targetId)) {
      syncToTargetMode(sourceModeId, targetId, sourceData, syncFields, authFields);
      dataManager.syncFromSource(targetId);
      cardStore.saveModesToLocal();
      console.log(`已完成root_admin到${targetId}的完整同步`);
    }
  });
};

// 具体同步实现（保留所有选项和字段，空值统一为null）
function syncToTargetMode(sourceId, targetId, sourceData, syncFields, authFields) {
  const cardStore = useCardStore();
  const targetMode = getMode(cardStore, targetId);
  
  if (!targetMode) return;
  
  // 确保目标模式有cardData数组（避免结构错误）
  if (!targetMode.cardData) {
    targetMode.cardData = [];
  }
  
  // 1. 保持卡片数量与源模式一致（源模式有的卡片必须存在，多余的删除）
  targetMode.cardData = targetMode.cardData.filter(targetCard => 
    sourceData.cards.some(sourceCard => sourceCard.id === targetCard.id)
  );
  
  // 2. 同步每张卡片的数据
  sourceData.cards.forEach(sourceCard => {
    // 构建要同步的卡片数据（保留所有字段结构）
    const cardToSync = {
      id: sourceCard.id, // 保持ID一致
      showDropdown: false,
      isTitleEditing: false,
      isOptionsEditing: false,
      isSelectEditing: false,
      // 设置编辑权限
      editableFields: {
        optionName: authFields.includes('选项名称'),
        optionValue: authFields.includes('选项值'),
        optionUnit: authFields.includes('选项单位'),
        optionCheckbox: authFields.includes('复选框'),
        optionActions: false, // 子模式不能添加/删除选项
        select: false // 子模式不能编辑下拉选项结构
      },
      data: {
        title: null, // 初始化标题为null（确保字段存在）
        options: [], // 确保选项数组存在
        selectOptions: [], // 下拉选项数组（必存在）
        selectedValue: '',
        // 预留下拉菜单显示控制（为将来隐藏功能留入口）
        showSelect: true // 目前默认显示，将来可通过配置改为false
      }
    };
    
    // 3. 同步选项（保留所有选项，字段必存在，空值为null）
    const existingTargetCard = targetMode.cardData.find(c => c.id === sourceCard.id);
    const targetOptions = existingTargetCard ? [...existingTargetCard.data.options] : [];
    
    // 确保源模式的选项在目标模式中都存在（不删除任何源模式有的选项）
    sourceCard.options.forEach(sourceOption => {
      const existingOption = targetOptions.find(o => o.id === sourceOption.id);
      
      // 处理选项的所有字段（必存在，空值为null）
      // 不管是否勾选同步，字段都保留，值根据同步配置决定
      const processed = {
        id: sourceOption.id, // ID必存在
        // 同步字段：用源模式的值（空值转null）；否则用目标原有值（无则为null）
        name: syncFields.includes('选项名称') 
          ? processValue(sourceOption.name) 
          : (existingOption?.name ?? null),
        value: syncFields.includes('选项值') 
          ? processValue(sourceOption.value) 
          : (existingOption?.value ?? null),
        unit: syncFields.includes('选项单位') 
          ? processValue(sourceOption.unit) 
          : (existingOption?.unit ?? null),
        checked: syncFields.includes('复选框状态') 
          ? sourceOption.checked 
          : (existingOption?.checked ?? false)
      };
      
      if (existingOption) {
        // 更新已有选项（所有字段都覆盖，确保字段存在）
        Object.assign(existingOption, processed);
      } else {
        // 新增选项（所有字段必存在，未同步的字段默认为null）
        targetOptions.push(processed);
      }
    });
    
    // 确保目标选项顺序与源模式一致
    cardToSync.data.options = targetOptions.sort((a, b) => {
      const indexA = sourceCard.options.findIndex(option => option.id === a.id);
      const indexB = sourceCard.options.findIndex(option => option.id === b.id);
      return indexA - indexB;
    });
    
    // 4. 下拉选项强制同步（必存在，为将来隐藏留入口）
    cardToSync.data.selectOptions = sourceCard.selectOptions.map(option => ({
      id: option.id,
      label: processValue(option.label) // 空值转null，确保字段存在
    }));
    
    // 5. 同步标题（确保字段存在，空值为null）
    cardToSync.data.title = syncFields.includes('标题')
      ? processValue(sourceCard.title)
      : (existingTargetCard?.data.title ?? null);
    
    // 6. 更新或新增卡片到目标模式（确保卡片存在）
    const targetCardIndex = targetMode.cardData.findIndex(c => c.id === sourceCard.id);
    if (targetCardIndex > -1) {
      targetMode.cardData[targetCardIndex] = cardToSync;
    } else {
      targetMode.cardData.push(cardToSync);
    }
  });
  
  // 7. 更新模式的元数据
  targetMode.lastSynced = new Date().toISOString();
  targetMode.source = 'root_admin'; // 标记数据来源
}
    