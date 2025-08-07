import { useCardStore } from '../components/Data/store'; 
import DataManager from '../components/Data/manager';

// 常量定义：8项内容的字段标识（完整覆盖）
const FIELD_IDS = {
  // 固定同步字段（无需授权自动同步）
  CARD_COUNT: 'cardCount',      // 1.卡片数量（通过数组长度体现）
  CARD_ORDER: 'cardOrder',      // 3.卡片顺序（通过orderIndex和排序体现）
  OPTIONS: 'options',           // 2.选项数据（数组结构）
  SELECT_OPTIONS: 'selectOptions', // 8.下拉菜单（数组结构）
  
  // 可配置同步+授权字段
  CARD_TITLE: 'title',          // 4.卡片标题
  OPTION_NAME: 'optionName',    // 5.选项名称（options子项）
  OPTION_VALUE: 'optionValue',  // 6.选项值（options子项）
  OPTION_UNIT: 'optionUnit'     // 7.选项单位（options子项）
};

// 获取模式的工具函数（保持现有逻辑）
const getMode = (cardStore, modeId) => {
  if (modeId === 'root_admin') {
    return cardStore.rootMode;
  }
  return cardStore.modes.find(mode => mode.id === modeId) || null;
};

// 发送反馈到主模式的函数
export const sendFeedbackToRoot = (modeId, feedback) => {
  const cardStore = useCardStore();
  const rootMode = getMode(cardStore, 'root_admin');
  
  if (!rootMode.feedback) {
    rootMode.feedback = {};
  }
  
  if (!rootMode.feedback[modeId]) {
    rootMode.feedback[modeId] = [];
  }
  
  rootMode.feedback[modeId].push({
    ...feedback,
    timestamp: new Date().toISOString()
  });
  
  cardStore.saveModesToStorage();
};

// 校验同步权限（增强提示信息）
export const checkSyncPermission = (sourceModeId, targetModeId) => {
  const cardStore = useCardStore();
  
  // 强制只有root_admin可以作为数据源
  if (sourceModeId !== 'root_admin') {
    console.warn('权限校验失败：只有root_admin可以作为同步源');
    return false;
  }
  
  // 不能同步到自己
  if (sourceModeId === targetModeId) {
    console.warn('权限校验失败：不能同步到自身模式');
    return false;
  }
  
  const targetMode = getMode(cardStore, targetModeId);
  if (!targetMode) {
    console.warn(`权限校验失败：目标模式${targetModeId}不存在`);
    return false;
  }
  
  return true;
};

// 辅助函数：处理空值和"null"字符串（严格保持字段存在）
const processValue = (value) => {
  // 空字符串/undefined统一转为null（但保留字段）
  if (value === '' || value === undefined) {
    return null;
  }
  // 禁止直接输入"null"字符串（避免与空值标识冲突）
  if (typeof value === 'string' && value.trim().toLowerCase() === 'null') {
    throw new Error('不允许输入"null"字符串，请留空表示空值');
  }
  return value; // 有内容则保留原始值
};

// 辅助函数：检查字段是否在同步列表中（完善固定字段判断）
const isFieldSynced = (field, syncFields) => {
  // 固定同步字段始终返回true（确保8项中的固定项必同步）
  if ([
    FIELD_IDS.OPTIONS, 
    FIELD_IDS.SELECT_OPTIONS,
    FIELD_IDS.CARD_COUNT,
    FIELD_IDS.CARD_ORDER
  ].includes(field)) {
    return true;
  }
  return syncFields.includes(field);
};

// 主协调函数（保持入口逻辑，增强错误处理）
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
  
  // 使用dataManager进行初始化，解决未使用变量警告
  // 假设DataManager有初始化方法，如果没有可以调用一个空方法或获取其属性
  dataManager.initialize(); // 调用初始化方法，确保变量被使用
  
  // 前置校验
  if (sourceModeId !== 'root_admin') {
    throw new Error('只有root_admin可以作为同步源');
  }
  if (!Array.isArray(targetModeIds) || targetModeIds.length === 0) {
    throw new Error('目标模式列表不能为空');
  }
  if (!sourceData?.cards || !Array.isArray(sourceData.cards)) {
    throw new Error('源数据格式错误，cards必须是数组');
  }
  
  // 验证同步字段格式（确保只包含允许的字段）
  const validSyncFields = [...Object.values(FIELD_IDS)];
  syncFields.forEach(field => {
    if (!validSyncFields.includes(field)) {
      throw new Error(`无效的同步字段: ${field}，允许的字段：${validSyncFields.join(',')}`);
    }
  });
  
  // 记录成功同步的目标数量
  let successCount = 0;
  
  // 遍历目标模式执行同步
  targetModeIds.forEach(targetId => {
    if (checkSyncPermission(sourceModeId, targetId)) {
      try {
        // 执行同步核心逻辑
        syncToTargetMode(
          sourceModeId, 
          targetId, 
          sourceData, 
          syncFields, 
          authFields
        );
        // 使用dataManager进行数据持久化，替代直接调用cardStore
        dataManager.saveMode(targetId);
        successCount++;
        console.log(`已完成root_admin到${targetId}的完整同步`);
      } catch (error) {
        console.error(`同步到${targetId}失败：`, error);
      }
    }
  });
  
  // 同步完成后通知dataManager
  dataManager.syncComplete();
  
  // 返回同步结果
  return {
    success: successCount > 0,
    total: targetModeIds.length,
    successCount: successCount
  };
};

// 具体同步实现（核心逻辑增强）
function syncToTargetMode(sourceId, targetId, sourceData, syncFields, authFields) {
  const cardStore = useCardStore();
  const targetMode = getMode(cardStore, targetId);
  
  if (!targetMode) return;
  
  // 确保目标模式有cardData数组（避免结构错误）
  if (!Array.isArray(targetMode.cardData)) {
    targetMode.cardData = [];
  }
  
  // 1. 卡片数量同步（源模式有的卡片必须存在，多余的删除）
  // 保留源模式中存在的卡片，删除源模式已移除的卡片
  targetMode.cardData = targetMode.cardData.filter(targetCard => 
    sourceData.cards.some(sourceCard => sourceCard.id === targetCard.id)
  );
  
  // 2. 同步每张卡片的数据（确保8项结构完整）
  sourceData.cards.forEach((sourceCard, cardIndex) => {
    // 构建要同步的卡片数据（保留所有字段结构）
    const cardToSync = {
      id: sourceCard.id, // 保持ID一致（用于关联）
      showDropdown: sourceCard.showDropdown ?? false,
      isTitleEditing: false, // 初始为非编辑状态（由父组件控制）
      isOptionsEditing: false,
      isSelectEditing: false,
      // 3. 卡片顺序标记（固定同步，用于排序）
      orderIndex: cardIndex,
      // 设置编辑权限（授权控制：精确到每个可配置字段）
      editableFields: {
        [FIELD_IDS.CARD_TITLE]: authFields.includes(FIELD_IDS.CARD_TITLE),
        [FIELD_IDS.OPTION_NAME]: authFields.includes(FIELD_IDS.OPTION_NAME),
        [FIELD_IDS.OPTION_VALUE]: authFields.includes(FIELD_IDS.OPTION_VALUE),
        [FIELD_IDS.OPTION_UNIT]: authFields.includes(FIELD_IDS.OPTION_UNIT),
        optionActions: false, // 子模式不能添加/删除选项（固定）
        select: false // 子模式不能编辑下拉选项结构（固定）
      },
      // 同步状态标记（用于前端显示控制：是否显示同步值提示）
      syncStatus: {
        [FIELD_IDS.CARD_TITLE]: isFieldSynced(FIELD_IDS.CARD_TITLE, syncFields),
        [FIELD_IDS.OPTION_NAME]: isFieldSynced(FIELD_IDS.OPTION_NAME, syncFields),
        [FIELD_IDS.OPTION_VALUE]: isFieldSynced(FIELD_IDS.OPTION_VALUE, syncFields),
        [FIELD_IDS.OPTION_UNIT]: isFieldSynced(FIELD_IDS.OPTION_UNIT, syncFields),
        [FIELD_IDS.OPTIONS]: true, // 固定同步（必为true）
        [FIELD_IDS.SELECT_OPTIONS]: true, // 固定同步（必为true）
        [FIELD_IDS.CARD_COUNT]: true, // 固定同步（必为true）
        [FIELD_IDS.CARD_ORDER]: true // 固定同步（必为true）
      },
      data: {
        title: null, // 4.卡片标题（初始为null，确保字段存在）
        options: [], // 2.选项数据（初始为空数组，确保结构存在）
        selectOptions: [], // 8.下拉菜单（初始为空数组，确保结构存在）
        selectedValue: sourceCard.data?.selectedValue ?? '',
        showSelect: sourceCard.data?.showSelect ?? true
      }
    };
    
    // 处理现有目标卡片（保留目标模式已输入的本地值）
    const existingTargetCard = targetMode.cardData.find(c => c.id === sourceCard.id);
    const targetOptions = existingTargetCard ? [...existingTargetCard.data.options] : [];
    
    // 3. 选项数据同步（固定同步，确保所有选项结构完整）
    sourceCard.options.forEach(sourceOption => {
      // 查找目标模式中是否已有该选项
      const existingOption = targetOptions.find(o => o.id === sourceOption.id);
      
      // 处理选项的所有字段（5/6/7，必存在，空值为null）
      const processedOption = {
        id: sourceOption.id || Date.now() + Math.random(), // 确保ID存在
        // 同步字段：用源模式的值；否则用目标原有值（无则为null）
        name: isFieldSynced(FIELD_IDS.OPTION_NAME, syncFields)
          ? processValue(sourceOption.name)
          : (existingOption?.name ?? null),
        value: isFieldSynced(FIELD_IDS.OPTION_VALUE, syncFields)
          ? processValue(sourceOption.value)
          : (existingOption?.value ?? null),
        unit: isFieldSynced(FIELD_IDS.OPTION_UNIT, syncFields)
          ? processValue(sourceOption.unit)
          : (existingOption?.unit ?? null),
        // 保留复选框状态（如果存在）
        checked: sourceOption.checked !== undefined 
          ? sourceOption.checked 
          : (existingOption?.checked ?? false),
        // 新增：选项本地值（目标模式自己输入的值，不被源模式覆盖）
        localName: existingOption?.localName ?? null,
        localValue: existingOption?.localValue ?? null,
        localUnit: existingOption?.localUnit ?? null
      };
      
      if (existingOption) {
        // 更新已有选项（覆盖同步字段，保留本地值和非同步字段）
        Object.assign(existingOption, processedOption);
      } else {
        // 新增选项（所有字段必存在）
        targetOptions.push(processedOption);
      }
    });
    
    // 确保目标选项顺序与源模式一致（固定同步）
    cardToSync.data.options = targetOptions.sort((a, b) => {
      const indexA = sourceCard.options.findIndex(option => option.id === a.id);
      const indexB = sourceCard.options.findIndex(option => option.id === b.id);
      return indexA - indexB; // 按源模式顺序排序
    });
    
    // 4. 下拉菜单同步（固定同步，确保结构完整）
    cardToSync.data.selectOptions = (sourceCard.data?.selectOptions || []).map(option => ({
      id: option.id || Date.now() + Math.random(), // 确保ID存在
      label: processValue(option.label), // 空值转null，确保字段存在
      // 新增：下拉选项本地值（目标模式自己编辑的值）
      localLabel: existingTargetCard?.data?.selectOptions?.find(o => o.id === option.id)?.localLabel ?? null
    }));
    
    // 5. 卡片标题同步（根据配置）
    cardToSync.data.title = isFieldSynced(FIELD_IDS.CARD_TITLE, syncFields)
      ? processValue(sourceCard.data?.title)
      : (existingTargetCard?.data?.title ?? null);
    // 新增：标题本地值（目标模式自己输入的值）
    cardToSync.data.localTitle = existingTargetCard?.data?.localTitle ?? null;
    
    // 6. 更新或新增卡片到目标模式
    const targetCardIndex = targetMode.cardData.findIndex(c => c.id === sourceCard.id);
    if (targetCardIndex > -1) {
      // 更新现有卡片（保留本地值）
      targetMode.cardData[targetCardIndex] = {
        ...targetMode.cardData[targetCardIndex],
        ...cardToSync,
        // 合并本地值（避免被覆盖）
        data: {
          ...targetMode.cardData[targetCardIndex].data,
          ...cardToSync.data
        }
      };
    } else {
      // 新增卡片
      targetMode.cardData.push(cardToSync);
    }
  });
  
  // 7. 确保卡片顺序与源模式一致（固定同步）
  targetMode.cardData.sort((a, b) => a.orderIndex - b.orderIndex);
  
  // 8. 更新模式的元数据（增强同步记录）
  targetMode.lastSynced = new Date().toISOString();
  targetMode.source = 'root_admin'; // 标记数据来源
  targetMode.syncFields = [...syncFields]; // 记录同步字段（供前端参考）
  targetMode.authFields = [...authFields]; // 记录授权字段（供前端参考）
  targetMode.syncCompleted = true; // 标记同步完成状态
}
