<template>
  <div class="other-mode-template">
    <!-- 顶部：模式名称容器 -->
    <header class="mode-header">
      <h1 class="mode-title">{{ modeInfo.name }}</h1>
      <div class="mode-meta">
        <span class="sync-status" :class="modeInfo.syncStatus">
          {{ getSyncStatusText(modeInfo.syncStatus) }}
        </span>
        <span class="last-sync">
          上次同步: {{ formatLastSyncTime(modeInfo.lastSyncTime) }}
        </span>
      </div>
    </header>
    
    <!-- 中间：UniversalCard组件容器 -->
    <main class="card-container">
      <div v-if="loadingCards" class="loading-indicator">
        <div class="spinner"></div>
        <p>加载卡片中...</p>
      </div>
      
      <div v-else-if="cards.length === 0" class="empty-state">
        <p>暂无卡片数据</p>
        <button 
          class="sync-button" 
          @click="syncWithRoot"
          :disabled="syncing"
        >
          {{ syncing ? '同步中...' : '从主模式同步' }}
        </button>
      </div>
      
      <div v-else class="cards-grid">
        <!-- 卡片容器：添加相对定位用于提示层定位 -->
        <div 
          v-for="card in processedCards"  
          :key="card.id" 
          class="card-wrapper"
        >
          <UniversalCard
            v-model:modelValue="card.computedTitle"
            v-model:options="card.computedOptions"
            v-model:selectedValue="card.data.selectedValue"
            :selectOptions="card.data.selectOptions"
            :showDropdown="card.showDropdown"
            :isTitleEditing="isFieldAuthorized(card, 'title')"
            :isOptionsEditing="isAnyOptionFieldAuthorized(card)"
            :isSelectEditing="isFieldAuthorized(card, 'select')"
            :editableFields="getEditableFields(card)"
            @add-option="(afterId) => handleAddOption(card.id, afterId)"
            @delete-option="(optionId) => handleDeleteOption(card.id, optionId)"
            @add-select-option="(label) => handleAddSelectOption(card.id, label)"
            @delete-select-option="(optionId) => handleDeleteSelectOption(card.id, optionId)"
            @dropdown-toggle="(value) => setShowDropdown(card.id, value)"
            @update:selectedValue="(value) => handleSelectedValueChange(card.id, value)"
            @update:options="(options) => handleOptionsChange(card.id, options)"
            @update:modelValue="(value) => handleTitleChange(card.id, value)"
            :className="''"
            :style="{}"
          />

          <!-- 同步提示层：根据同步和授权状态显示灰色提示 -->
          <div class="sync-hints">
            <!-- 标题同步提示 -->
            <div 
              class="hint-text title-hint"
              v-if="shouldShowHint(card, 'title')"
            >
              同步值：{{ card.data.title?.syncValue || '空' }}
            </div>

            <!-- 选项同步提示 -->
            <template v-for="(opt, optIndex) in filteredOptions(card)" :key="`option-${card.id}-${opt.id}`">
              <div 
                class="hint-text option-name-hint"
                :style="{ top: `${40 + optIndex * 36}px` }"
                v-if="shouldShowOptionHint(card, optIndex, 'name')"
              >
                同步名称：{{ opt.syncName || '空' }}
              </div>
              
              <div 
                class="hint-text option-value-hint"
                :style="{ top: `${40 + optIndex * 36}px` }"
                v-if="shouldShowOptionHint(card, optIndex, 'value')"
              >
                同步值：{{ opt.syncValue || '空' }}
              </div>
              
              <div 
                class="hint-text option-unit-hint"
                :style="{ top: `${40 + optIndex * 36}px` }"
                v-if="shouldShowOptionHint(card, optIndex, 'unit')"
              >
                同步单位：{{ opt.syncUnit || '空' }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </main>
    
    <!-- 底部：匹配/评分容器 -->
    <footer class="matching-container">
      <h2 class="matching-title">与主模式比对结果</h2>
      
      <div v-if="calculatingMatch" class="calculating">
        <div class="spinner small"></div>
        <p>计算匹配度中...</p>
      </div>
      
      <div v-else class="match-result">
        <div class="match-score">
          <span class="score-label">匹配度:</span>
          <span class="score-value">{{ matchScore }}%</span>
          <div class="score-bar">
            <div 
              class="score-fill" 
              :style="{ width: `${matchScore}%`, backgroundColor: getScoreColor() }"
            ></div>
          </div>
        </div>
        
        <div class="match-details">
          <p>卡片数量匹配: {{ cardCountMatch ? '一致' : '不一致' }}</p>
          <p>选项配置匹配: {{ optionConfigMatch ? '一致' : '不一致' }}</p>
          <p>最后比对时间: {{ formatLastMatchTime() }}</p>
        </div>
        
        <button 
          class="recalculate-button" 
          @click="calculateMatchScore"
          :disabled="calculatingMatch"
        >
          重新计算匹配度
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useCardStore } from '../Data/store';
import UniversalCard from '../UniversalCard/UniversalCard.vue';
import { coordinateMode, sendFeedbackToRoot } from '../../utils/modeCoordinator';
import { FIELD_IDS } from '../../utils/constants';

// 接收从路由传入的模式ID
const props = defineProps({
  modeId: {
    type: String,
    required: true
  }
});

// 状态管理
const cardStore = useCardStore();
const loadingCards = ref(true);
const syncing = ref(false);
const calculatingMatch = ref(false);
const matchScore = ref(0);
const cardCountMatch = ref(false);
const optionConfigMatch = ref(false);
const lastMatchTime = ref(null);

// 获取当前模式信息
const modeInfo = computed(() => {
  return cardStore.modes.find(mode => mode.id === props.modeId) || {
    id: props.modeId,
    name: '未知模式',
    syncStatus: 'unsynced',
    lastSyncTime: null,
    syncFields: [],
    authFields: []
  };
});

// 获取当前模式的原始卡片数据
const rawCards = computed(() => {
  const mode = modeInfo.value;
  return mode.cardData ? [...mode.cardData] : [];
});

// 处理卡片数据：提前计算v-model需要的值
const processedCards = computed(() => {
  return rawCards.value.map(card => ({
    ...card,
    // 提前计算标题值，供v-model绑定
    computedTitle: getFieldValue(card, 'title'),
    // 提前计算选项值，供v-model绑定
    computedOptions: getOptionsValue(card)
  }));
});

// 对外暴露的cards属性（保持原有逻辑兼容）
const cards = computed({
  get: () => rawCards.value,
  set: (newCards) => {
    const modeIndex = cardStore.modes.findIndex(m => m.id === props.modeId);
    if (modeIndex !== -1) {
      cardStore.modes[modeIndex].cardData = newCards;
      cardStore.saveModesToStorage();
    }
  }
});

// 过滤选项的计算属性，用于解决v-for和v-if同时使用的问题
const filteredOptions = (card) => {
  return (card.data.options || []).filter(() => true);
};

// 根据同步状态获取字段显示值
const getFieldValue = (card, fieldType) => {
  // 检查是否有同步值且已同步该字段
  if (card.data[fieldType]?.syncValue !== undefined && 
      modeInfo.value.syncFields?.includes(getFieldId(fieldType))) {
    return card.data[fieldType].localValue !== undefined 
      ? card.data[fieldType].localValue 
      : card.data[fieldType].syncValue;
  }
  // 未同步或无同步值，返回本地值或空
  return card.data[fieldType]?.localValue || '';
};

// 获取选项显示值
const getOptionsValue = (card) => {
  return (card.data.options || []).map(opt => ({
    id: opt.id,
    name: getOptionFieldValue(card, opt, 'name'),
    value: getOptionFieldValue(card, opt, 'value'),
    unit: getOptionFieldValue(card, opt, 'unit'),
    checked: opt.checked || false
  }));
};

// 获取单个选项字段的值
const getOptionFieldValue = (card, option, fieldType) => {
  // 检查是否有同步值且已同步该字段
  if (option[`sync${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`] !== undefined &&
      modeInfo.value.syncFields?.includes(getFieldId(`option${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`))) {
    return option[`local${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`] !== undefined
      ? option[`local${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`]
      : option[`sync${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`];
  }
  // 未同步或无同步值，返回本地值或空
  return option[`local${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`] || '';
};

// 检查字段是否授权编辑
const isFieldAuthorized = (card, fieldType) => {
  return modeInfo.value.authFields?.includes(getFieldId(fieldType)) || false;
};

// 检查是否有任何选项字段被授权
const isAnyOptionFieldAuthorized = () => {
  return [FIELD_IDS.OPTION_NAME, FIELD_IDS.OPTION_VALUE, FIELD_IDS.OPTION_UNIT]
    .some(fieldId => modeInfo.value.authFields?.includes(fieldId));
};

// 获取可编辑字段配置
const getEditableFields = (card) => ( {
  optionName: isFieldAuthorized(card, 'optionName'),
  optionValue: isFieldAuthorized(card, 'optionValue'),
  optionUnit: isFieldAuthorized(card, 'optionUnit'),
  optionCheckbox: isFieldAuthorized(card, 'options'),
  optionActions: isFieldAuthorized(card, 'options'),
  select: isFieldAuthorized(card, 'select')
});

// 判断是否显示灰色提示（同步且授权时显示）
const shouldShowHint = (card, fieldType) => {
  return isFieldAuthorized(card, fieldType) && 
         modeInfo.value.syncFields?.includes(getFieldId(fieldType)) &&
         card.data[fieldType]?.syncValue !== null &&
         card.data[fieldType]?.syncValue !== undefined;
};

// 判断选项字段是否显示灰色提示
const shouldShowOptionHint = (card, optIndex, fieldType) => {
  const option = filteredOptions(card)[optIndex];
  if (!option) return false;
  
  return isFieldAuthorized(card, `option${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`) &&
         modeInfo.value.syncFields?.includes(getFieldId(`option${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`)) &&
         option[`sync${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`] !== null &&
         option[`sync${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`] !== undefined;
};

// 字段ID映射
const getFieldId = (fieldType) => {
  const fieldMap = {
    title: FIELD_IDS.CARD_TITLE,
    optionName: FIELD_IDS.OPTION_NAME,
    optionValue: FIELD_IDS.OPTION_VALUE,
    optionUnit: FIELD_IDS.OPTION_UNIT,
    options: FIELD_IDS.OPTIONS,
    select: FIELD_IDS.SELECT_OPTIONS
  };
  return fieldMap[fieldType] || fieldType;
};

// 初始化
onMounted(() => {
  // 加载卡片数据
  loadingCards.value = false;
  
  // 初始计算匹配度
  if (cards.value.length > 0) {
    calculateMatchScore();
  }
});

// 监听卡片变化，自动更新匹配度
watch(
  () => [...cards.value],
  (newCards) => {
    if (newCards.length > 0) {
      // 延迟计算，避免频繁触发
      setTimeout(() => {
        calculateMatchScore();
      }, 1000);
    }
  },
  { deep: true }
);

// 同步状态文本
const getSyncStatusText = (status) => {
  const statusMap = {
    synced: '已同步',
    unsynced: '未同步',
    conflict: '冲突'
  };
  return statusMap[status] || '未知状态';
};

// 格式化时间
const formatLastSyncTime = (time) => {
  if (!time) return '从未同步';
  return new Date(time).toLocaleString();
};

const formatLastMatchTime = () => {
  if (!lastMatchTime.value) return '未计算';
  return new Date(lastMatchTime.value).toLocaleString();
};

// 与主模式同步数据
const syncWithRoot = async () => {
  syncing.value = true;
  
  try {
    const result = await coordinateMode({
      sourceModeId: 'root_admin',
      targetModeIds: [props.modeId],
      // 传递当前模式已配置的同步和授权字段
      syncFields: modeInfo.value.syncFields || [],
      authFields: modeInfo.value.authFields || []
    });
    
    if (result.success) {
      // 同步成功后重新计算匹配度
      setTimeout(() => {
        calculateMatchScore();
      }, 500);
    }
  } catch (error) {
    console.error('同步失败:', error);
    alert(`同步失败: ${error.message}`);
  } finally {
    syncing.value = false;
  }
};

// 计算与主模式的匹配度
const calculateMatchScore = async () => {
  calculatingMatch.value = true;
  
  try {
    // 获取主模式数据
    const rootMode = cardStore.modes.find(m => m.id === 'root_admin');
    if (!rootMode || !rootMode.cardData || rootMode.cardData.length === 0) {
      throw new Error('主模式没有可用数据进行比对');
    }
    
    // 简单的匹配度计算逻辑
    let score = 0;
    const rootCards = rootMode.cardData;
    
    // 卡片数量匹配度 (30%)
    const cardCountRatio = Math.min(cards.value.length / rootCards.length, 1);
    cardCountMatch.value = cards.value.length === rootCards.length;
    score += cardCountRatio * 30;
    
    // 选项配置匹配度 (70%)
    let optionMatchTotal = 0;
    const comparedCards = Math.min(cards.value.length, rootCards.length);
    
    for (let i = 0; i < comparedCards; i++) {
      const targetCard = cards.value[i];
      const sourceCard = rootCards[i];
      
      if (targetCard.data && sourceCard.data) {
        // 标题匹配
        const titleMatch = targetCard.data.title?.syncValue === sourceCard.data.title ? 1 : 0;
        
        // 选项数量匹配
        const targetOptions = targetCard.data.options || [];
        const sourceOptions = sourceCard.data.options || [];
        const optionCountRatio = Math.min(targetOptions.length / sourceOptions.length, 1);
        
        // 选项内容匹配
        let optionContentMatch = 0;
        const comparedOptions = Math.min(targetOptions.length, sourceOptions.length);
        
        for (let j = 0; j < comparedOptions; j++) {
          const targetOpt = targetOptions[j];
          const sourceOpt = sourceOptions[j];
          
          if (targetOpt.syncName === sourceOpt.name && 
              targetOpt.syncValue === sourceOpt.value && 
              targetOpt.syncUnit === sourceOpt.unit) {
            optionContentMatch++;
          }
        }
        
        const optionContentRatio = comparedOptions > 0 ? optionContentMatch / comparedOptions : 0;
        
        // 综合单张卡片的匹配度
        const cardOptionScore = (titleMatch * 0.3) + (optionCountRatio * 0.3) + (optionContentRatio * 0.4);
        optionMatchTotal += cardOptionScore;
      }
    }
    
    const optionMatchAvg = comparedCards > 0 ? optionMatchTotal / comparedCards : 0;
    optionConfigMatch.value = optionMatchAvg > 0.9; // 90%以上视为配置一致
    score += optionMatchAvg * 70;
    
    // 保存结果
    matchScore.value = Math.round(score);
    lastMatchTime.value = new Date().toISOString();
    
    // 向主模式发送匹配度反馈
    sendFeedbackToRoot(props.modeId, {
      type: 'match_score',
      score: matchScore.value,
      timestamp: lastMatchTime.value
    });
    
  } catch (error) {
    console.error('计算匹配度失败:', error);
  } finally {
    calculatingMatch.value = false;
  }
};

// 根据分数获取颜色
const getScoreColor = () => {
  if (matchScore.value >= 80) return '#4caf50'; // 绿色
  if (matchScore.value >= 50) return '#ff9800'; // 橙色
  return '#f44336'; // 红色
};

// 处理标题变化
const handleTitleChange = (cardId, value) => {
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1 && isFieldAuthorized(cards.value[cardIndex], 'title')) {
    const newCards = [...cards.value];
    // 确保title对象存在
    if (!newCards[cardIndex].data.title) {
      newCards[cardIndex].data.title = {};
    }
    // 只更新本地值，保留同步值
    newCards[cardIndex].data.title.localValue = value;
    cards.value = newCards;
  }
};

// 卡片操作方法
const handleAddOption = (cardId, afterId) => {
  const targetCard = cards.value.find(c => c.id === cardId);
  if (!targetCard || !isAnyOptionFieldAuthorized(targetCard)) return;
  
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const card = { ...cards.value[cardIndex] };
    const options = [...(card.data.options || [])];
    
    // 找到插入位置
    const insertIndex = afterId 
      ? options.findIndex(opt => opt.id === afterId) + 1 
      : 0;
    
    // 添加新选项（包含同步和本地值字段）
    const newOption = {
      id: Date.now(),
      syncName: null,
      syncValue: null,
      syncUnit: null,
      localName: '',
      localValue: '',
      localUnit: '',
      checked: false
    };
    
    options.splice(insertIndex, 0, newOption);
    card.data.options = options;
    
    // 更新卡片数组
    const newCards = [...cards.value];
    newCards[cardIndex] = card;
    cards.value = newCards;
  }
};

const handleDeleteOption = (cardId, optionId) => {
  const targetCard = cards.value.find(c => c.id === cardId);
  if (!targetCard || !isAnyOptionFieldAuthorized(targetCard)) return;
  
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const card = { ...cards.value[cardIndex] };
    if (!card.data.options) return;
    
    // 删除选项
    card.data.options = card.data.options.filter(opt => opt.id !== optionId);
    
    // 更新卡片数组
    const newCards = [...cards.value];
    newCards[cardIndex] = card;
    cards.value = newCards;
  }
};

const handleAddSelectOption = (cardId, label) => {
  const targetCard = cards.value.find(c => c.id === cardId);
  if (!targetCard || !isFieldAuthorized(targetCard, 'select') || !label) return;
  
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const card = { ...cards.value[cardIndex] };
    const selectOptions = [...(card.data.selectOptions || [])];
    
    // 添加新的下拉选项
    selectOptions.push({
      id: Date.now(),
      label: label
    });
    
    card.data.selectOptions = selectOptions;
    
    // 更新卡片数组
    const newCards = [...cards.value];
    newCards[cardIndex] = card;
    cards.value = newCards;
  }
};

const handleDeleteSelectOption = (cardId, optionId) => {
  const targetCard = cards.value.find(c => c.id === cardId);
  if (!targetCard || !isFieldAuthorized(targetCard, 'select')) return;
  
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const card = { ...cards.value[cardIndex] };
    if (!card.data.selectOptions) return;
    
    // 删除下拉选项
    card.data.selectOptions = card.data.selectOptions.filter(opt => opt.id !== optionId);
    
    // 如果删除的是当前选中项，清除选择
    if (card.data.selectedValue && 
        !card.data.selectOptions.some(opt => opt.label === card.data.selectedValue)) {
      card.data.selectedValue = '';
    }
    
    // 更新卡片数组
    const newCards = [...cards.value];
    newCards[cardIndex] = card;
    cards.value = newCards;
  }
};

const setShowDropdown = (cardId, value) => {
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const newCards = [...cards.value];
    newCards[cardIndex].showDropdown = value;
    cards.value = newCards;
  }
};

const handleSelectedValueChange = (cardId, value) => {
  const targetCard = cards.value.find(c => c.id === cardId);
  if (!targetCard || !isFieldAuthorized(targetCard, 'select')) return;
  
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const newCards = [...cards.value];
    newCards[cardIndex].data.selectedValue = value;
    cards.value = newCards;
  }
};

const handleOptionsChange = (cardId, options) => {
  const targetCard = cards.value.find(c => c.id === cardId);
  if (!targetCard || !isAnyOptionFieldAuthorized(targetCard)) return;
  
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const newCards = [...cards.value];
    // 保留同步值，只更新本地值
    newCards[cardIndex].data.options = newCards[cardIndex].data.options.map((originalOpt, i) => {
      const newOpt = options[i] || {};
      return {
        ...originalOpt,
        localName: newOpt.name,
        localValue: newOpt.value,
        localUnit: newOpt.unit,
        checked: newOpt.checked || false
      };
    });
    cards.value = newCards;
  }
};
</script>

<style scoped>
.other-mode-template {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 15px;
  gap: 20px;
}

/* 顶部模式名称容器 */
.mode-header {
  padding: 15px 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.mode-title {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 24px;
}

.mode-meta {
  display: flex;
  gap: 15px;
  font-size: 14px;
  color: #666;
  flex-wrap: wrap;
}

.sync-status {
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.sync-status.synced {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.sync-status.unsynced {
  background-color: #fff3e0;
  color: #e65100;
}

.sync-status.conflict {
  background-color: #ffebee;
  color: #d32f2f;
}

/* 中间卡片容器 - 仅管理容器布局，不涉及卡片本身样式 */
.card-container {
  flex-grow: 1;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #666;
}

.cards-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: center;
}

/* 卡片包装器：仅用于定位提示文本，不影响卡片本身 */
.card-wrapper {
  position: relative;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #666;
  text-align: center;
}

.sync-button {
  margin-top: 15px;
  padding: 8px 16px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.sync-button:hover:not(:disabled) {
  background-color: #1976d2;
}

.sync-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 同步提示文本样式 - 严格限制在提示层内，不影响卡片 */
.sync-hints {
  position: absolute;
  pointer-events: none; /* 不影响卡片交互 */
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  padding: 10px;
  box-sizing: border-box;
  z-index: 10; /* 确保提示在卡片上方但不影响样式 */
}

.hint-text {
  position: absolute;
  color: #999;
  font-size: 12px;
  font-style: italic;
  background: rgba(255, 255, 255, 0.8);
  padding: 0 4px;
  pointer-events: none;
}

.title-hint {
  top: 10px;
  left: 10px;
}

.option-name-hint {
  left: 10px;
}

.option-value-hint {
  left: 150px;
}

.option-unit-hint {
  left: 280px;
}

/* 底部匹配/评分容器 */
.matching-container {
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.matching-title {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
}

.calculating {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #666;
  padding: 10px 0;
}

.match-result {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.match-score {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-label {
  font-weight: 500;
  color: #555;
}

.score-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.score-bar {
  height: 8px;
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  transition: width 0.5s ease;
}

.match-details {
  font-size: 14px;
  color: #666;
  display: flex;
  flex-wrap: wrap;
  gap: 15px 30px;
}

.recalculate-button {
  align-self: flex-start;
  padding: 8px 16px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.recalculate-button:hover:not(:disabled) {
  background-color: #388e3c;
}

.recalculate-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 加载动画 */
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner.small {
  width: 20px;
  height: 20px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .mode-meta {
    flex-direction: column;
    gap: 5px;
  }
  
  .match-details {
    flex-direction: column;
    gap: 5px;
  }
  
  .hint-text {
    font-size: 10px;
  }
  
  .option-value-hint {
    left: 120px;
  }
  
  .option-unit-hint {
    left: 220px;
  }
}
</style>
