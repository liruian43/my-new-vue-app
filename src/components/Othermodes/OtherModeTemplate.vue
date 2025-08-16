<template>
  <!-- 整体容器 -->
  <div class="other-mode-container">
    <!-- 第一个容器：简化的长条模式名称容器 -->
    <div class="mode-name-bar">
      <h2 class="mode-name">{{ modeInfo.name }}</h2>
    </div>

    <!-- 第二个容器：卡片区（与主模式完全一致） -->
    <div class="card-section-container">
      <div class="main-content">
        <!-- 加载状态 -->
        <div v-if="loadingCards" class="loading-indicator">
          <div class="spinner"></div>
          <p>加载卡片中...</p>
        </div>
        
        <!-- 空状态 -->
        <div v-else-if="cards.length === 0" class="empty-state">
          <p>暂无卡片数据</p>
        </div>
        
        <!-- 卡片列表（与主模式完全一致） -->
        <div v-else class="cards-container">
          <div
            v-for="card in processedCards"
            :key="card.id"
            class="card-wrapper"
            :class="{ 
              selected: selectedCardId === card.id,
              invalid: !isCardValid(card)
            }"
            @click.stop="selectCard(card.id)"
          >
            <!-- 受控组件自身决定宽度 -->
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
              @dropdown-toggle="(value) => setShowDropdown(card.id, value)"
              @update:selectedValue="(value) => handleSelectedValueChange(card.id, value)"
              @update:options="(options) => handleOptionsChange(card.id, options)"
              @update:modelValue="(value) => handleTitleChange(card.id, value)"
            />

            <!-- 同步提示层 -->
            <div class="sync-hints">
              <div 
                class="hint-text title-hint"
                v-if="shouldShowHint(card, 'title')"
              >
                同步值：{{ card.data.title?.syncValue || '空' }}
              </div>

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
      </div>
    </div>

    <!-- 第三个容器：匹配反馈区（预留） -->
    <div class="matching-feedback-container">
      <!-- 顶部中间的生成按钮 -->
      <div class="matching-controls">
        <button 
          class="generate-button" 
          @click="handleGenerateMatch"
          :disabled="isGenerating"
        >
          <i class="fas fa-magic"></i> 生成
        </button>
      </div>
      
      <!-- 预留匹配结果区域（暂不实现） -->
      <div class="matching-results placeholder">
        <div v-if="isGenerating" class="generating-indicator">
          <div class="spinner small"></div>
          <p>正在处理匹配...</p>
        </div>
        <div v-else>
          <p class="placeholder-text">匹配结果将显示在这里</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCardStore } from '../Data/store';
import UniversalCard from '../UniversalCard/UniversalCard.vue';

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
const selectedCardId = ref(null);
const isGenerating = ref(false); // 生成按钮状态

// 获取当前模式信息（名称来自root_admin创建时的设置）
const modeInfo = computed(() => {
  return cardStore.modes.find(mode => mode.id === props.modeId) || {
    id: props.modeId,
    name: '未命名模式', // 名称由创建时设置
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

// 处理卡片数据
const processedCards = computed(() => {
  return rawCards.value.map(card => ({
    ...card,
    computedTitle: getFieldValue(card, 'title'),
    computedOptions: getOptionsValue(card)
  }));
});

// 对外暴露的cards属性
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

// 过滤选项
const filteredOptions = (card) => {
  return (card.data.options || []).filter(() => true);
};

// 选中卡片
const selectCard = (id) => {
  selectedCardId.value = id;
};

// 卡片有效性检查
const isCardValid = (card) => {
  return true;
};

// 获取字段值
const getFieldValue = (card, fieldType) => {
  if (card.data[fieldType]?.syncValue !== undefined && 
      modeInfo.value.syncFields?.includes(getFieldId(fieldType))) {
    return card.data[fieldType].localValue !== undefined 
      ? card.data[fieldType].localValue 
      : card.data[fieldType].syncValue;
  }
  return card.data[fieldType]?.localValue || '';
};

// 获取选项值
const getOptionsValue = (card) => {
  return (card.data.options || []).map(opt => ({
    id: opt.id,
    name: getOptionFieldValue(card, opt, 'name'),
    value: getOptionFieldValue(card, opt, 'value'),
    unit: getOptionFieldValue(card, opt, 'unit'),
    checked: opt.checked || false
  }));
};

// 获取单个选项字段值
const getOptionFieldValue = (card, option, fieldType) => {
  if (option[`sync${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`] !== undefined &&
      modeInfo.value.syncFields?.includes(getFieldId(`option${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`))) {
    return option[`local${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`] !== undefined
      ? option[`local${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`]
      : option[`sync${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`];
  }
  return option[`local${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`] || '';
};

// 检查字段授权
const isFieldAuthorized = (card, fieldType) => {
  return modeInfo.value.authFields?.includes(getFieldId(fieldType)) || false;
};

// 检查选项字段授权
const isAnyOptionFieldAuthorized = () => {
  return [FIELD_IDS.OPTION_NAME, FIELD_IDS.OPTION_VALUE, FIELD_IDS.OPTION_UNIT]
    .some(fieldId => modeInfo.value.authFields?.includes(fieldId));
};

// 获取可编辑字段
const getEditableFields = (card) => ({
  optionName: isFieldAuthorized(card, 'optionName'),
  optionValue: isFieldAuthorized(card, 'optionValue'),
  optionUnit: isFieldAuthorized(card, 'optionUnit'),
  optionCheckbox: isFieldAuthorized(card, 'options'),
  optionActions: isFieldAuthorized(card, 'options'),
  select: isFieldAuthorized(card, 'select')
});

// 显示提示判断
const shouldShowHint = (card, fieldType) => {
  return isFieldAuthorized(card, fieldType) && 
         modeInfo.value.syncFields?.includes(getFieldId(fieldType)) &&
         card.data[fieldType]?.syncValue !== null &&
         card.data[fieldType]?.syncValue !== undefined;
};

// 显示选项提示判断
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
  loadingCards.value = false;
});

// 处理标题变化
const handleTitleChange = (cardId, value) => {
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1 && isFieldAuthorized(cards.value[cardIndex], 'title')) {
    const newCards = [...cards.value];
    if (!newCards[cardIndex].data.title) {
      newCards[cardIndex].data.title = {};
    }
    newCards[cardIndex].data.title.localValue = value;
    cards.value = newCards;
  }
};

// 处理选项变化
const handleOptionsChange = (cardId, options) => {
  const targetCard = cards.value.find(c => c.id === cardId);
  if (!targetCard || !isAnyOptionFieldAuthorized(targetCard)) return;
  
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const newCards = [...cards.value];
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

// 下拉框控制
const setShowDropdown = (cardId, value) => {
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const newCards = [...cards.value];
    newCards[cardIndex].showDropdown = value;
    cards.value = newCards;
  }
};

// 选择值变化
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

// 匹配生成按钮点击事件（预留逻辑位置）
const handleGenerateMatch = async () => {
  isGenerating.value = true;
  
  try {
    // 预留：匹配逻辑将在这里实现
    console.log('开始执行匹配生成...');
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('匹配生成完成');
    
  } catch (error) {
    console.error('匹配生成失败:', error);
  } finally {
    isGenerating.value = false;
  }
};
</script>

<style scoped>
/* 整体容器 */
.other-mode-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
}

/* 第一个容器：简化的长条模式名称容器 */
.mode-name-bar {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f5f5f5;
  box-sizing: border-box;
}

.mode-name {
  margin: 0;
  color: #333;
  font-size: 1.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 第二个容器：卡片区（与主模式完全一致） */
.card-section-container {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background-color: #fff;
  box-sizing: border-box;
}

.main-content {
  padding: 10px;
  border-radius: 6px;
}

/* 卡片容器 - 弹性布局自动换行 */
.cards-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 卡片包装器 - 弹性选中框 */
.card-wrapper {
  position: relative;
  transition: all 0.3s ease;
  cursor: pointer;
}

.card-wrapper.selected {
  box-shadow: 0 0 0 3px #4caf50;
  border-radius: 6px;
}

.card-wrapper.invalid {
  box-shadow: 0 0 0 3px #f44336;
  border-radius: 6px;
}

/* 加载和空状态 */
.loading-indicator, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #666;
  text-align: center;
}

/* 同步提示文本 */
.sync-hints {
  position: absolute;
  pointer-events: none;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  padding: 10px;
  box-sizing: border-box;
  z-index: 10;
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

/* 第三个容器：匹配反馈区 */
.matching-feedback-container {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background-color: #f9f9f9;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
}

/* 匹配控制区 */
.matching-controls {
  display: flex;
  justify-content: center;
  padding: 5px 0;
}

.generate-button {
  padding: 8px 16px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  transition: background-color 0.3s;
}

.generate-button:hover:not(:disabled) {
  background-color: #1976d2;
}

.generate-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 匹配结果区域（预留） */
.matching-results {
  min-height: 80px;
  padding: 10px;
  border-radius: 4px;
  background-color: #fff;
  border: 1px dashed #ccc;
}

.generating-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
  padding: 15px 0;
}

.placeholder-text {
  text-align: center;
  color: #999;
  padding: 15px 0;
  margin: 0;
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
  .hint-text {
    font-size: 10px;
  }
}
</style>
