<template>
  <div class="card-section">
    <!-- 联动控制组件：仅在root_admin模式显示 -->
    <ModeLinkageControl 
      v-if="isRootAdminMode" 
      @confirm-linkage="handleLinkage" 
    />

    <!-- 顶部控制按钮 -->
    <div class="card-controls">
      <!-- 配置检查按钮（允许在预设模式中使用） -->
      <button 
        class="test-button check-complete-btn" 
        @click="checkConfigurationComplete"
        :class="{ 
          success: checkResult === 'pass', 
          error: checkResult === 'fail',
          loading: checkResult === 'loading'
        }"
        :disabled="checkResult === 'loading'"
      >
        {{ 
          checkResult === 'loading' ? '检查中…' : 
          checkResult === 'pass' ? '检查通过' : 
          '配置检查' 
        }}
      </button>

      <!-- 添加/删除卡片（允许在预设模式中使用） -->
      <button class="test-button" @click="addCard">
        添加卡片
      </button>
      <button
        class="test-button"
        @click="prepareDeleteCard"
        :disabled="!selectedCardId"
      >
        删除卡片
      </button>

      <!-- 编辑标题（允许在预设模式中使用） -->
      <button
        class="test-button"
        @click="toggleTitleEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isTitleEditing }"
      >
        {{ selectedCard?.isTitleEditing ? "完成标题编辑" : "编辑标题" }}
      </button>
      
      <!-- 编辑预设（独立；开启时禁用除四个例外外的所有其他按钮，并强制具备两项基础能力） -->
      <button
        class="test-button"
        @click="togglePresetEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.isPresetEditing ? "完成预设" : "编辑预设" }}
      </button>

      <!-- 基础按钮：编辑下拉菜单（在预设模式中禁用） -->
      <button
        class="test-button"
        @click="toggleSelectEditing"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.isSelectEditing && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.isSelectEditing ? "完成下拉菜单编辑" : "编辑下拉菜单" }}
      </button>

      <!-- 以下均为选项栏细分的独立控制（在预设模式中禁用） -->
      <button
        class="test-button"
        @click="() => toggleEditableField('optionName')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionName && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionName ? "完成名称编辑" : "编辑选项名称" }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionValue')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionValue && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionValue ? "完成值编辑" : "编辑选项值" }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionUnit')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionUnit && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionUnit ? "完成单位编辑" : "编辑选项单位" }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionCheckbox')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionCheckbox && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionCheckbox ? "隐藏选项复选框" : "显示选项复选框" }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionActions')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionActions && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionActions ? "隐藏选项按钮" : "显示选项按钮" }}
      </button>
    </div>

    <!-- 预设编辑提示 -->
    <div 
      v-if="selectedCard?.isPresetEditing" 
      class="preset-editing-hint"
    >
      <p>预设编辑模式：选择或添加一个下拉选项，勾选需要关联的选项，自动保存关联；点击“完成预设”将保存并退出。</p>
    </div>

    <!-- 卡片列表 -->
    <div class="cards-container">
      <div
        v-for="card in cards"
        :key="card.id"
        class="card-wrapper"
        :class="{ 
          deleting: deletingCardId === card.id, 
          selected: selectedCardId === card.id,
          invalid: checkResult === 'fail' && !isCardValid(card),
          'hide-option-actions': !card.editableFields.optionActions || card.isPresetEditing
        }"
        @click.stop="selectCard(card.id)"
      >
        <UniversalCard
          v-model:modelValue="card.data.title"
          v-model:options="card.data.options"
          v-model:selectedValue="card.data.selectedValue"
          :selectOptions="card.data.selectOptions"

          :showDropdown="card.showDropdown || card.isPresetEditing"
          :isTitleEditing="card.isTitleEditing"
          :isOptionsEditing="card.isPresetEditing || card.isOptionsEditing"
          :isSelectEditing="card.isPresetEditing || card.isSelectEditing"

          :on-add-option="(afterId) => handleAddOption(card.id, afterId)"
          :on-delete-option="(optionId) => handleDeleteOption(card.id, optionId)"
          :on-add-select-option="(label) => handleAddSelectOption(card.id, label)"
          :on-delete-select-option="(optionId) => handleDeleteSelectOption(card.id, optionId)"
          :on-dropdown-toggle="(value) => setShowDropdown(card.id, value)"

          :editableFields="{
            ...card.editableFields,
            optionActions: true,
            // 预设编辑时强制显示复选框；退出预设后按用户设置
            optionCheckbox: card.editableFields.optionCheckbox || card.isPresetEditing
          }"
          :class="{ selected: selectedCardId === card.id }"
          :style="{}"
        />

        <div v-if="deletingCardId === card.id" class="delete-overlay">
          <button class="delete-card-button" @click.stop="confirmDeleteCard(card.id)">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useCardStore } from '../components/Data/store';
import UniversalCard from '../components/UniversalCard/UniversalCard.vue';
import ModeLinkageControl from '../components/ModeLinkageControl.vue';
import { coordinateMode } from '../utils/modeCoordinator';
import { useRoute } from 'vue-router';

// 路由判断逻辑：仅匹配/root_admin及其所有子路径
const route = useRoute();
const cardStore = useCardStore();

// 模式判断
const isRootAdminMode = computed(() => {
  return /^\/root_admin($|\/)/.test(route.path);
});

// 卡片数据
const cards = computed(() => {
  return [
    ...(Array.isArray(cardStore.tempCards) ? cardStore.tempCards : []),
    ...(Array.isArray(cardStore.sessionCards) ? cardStore.sessionCards : [])
  ];
});

// 选中/删除中的卡片
const selectedCardId = computed({
  get: () => cardStore.selectedCardId,
  set: (value) => {
    cardStore.selectedCardId = value;
  }
});

const deletingCardId = computed({
  get: () => cardStore.deletingCardId,
  set: (value) => cardStore.deletingCardId = value
});

const selectedCard = computed(() => cardStore.selectedCard);

// 会话级源数据区数据
const sessionSourceData = computed(() => {
  const data = cardStore.currentModeSessionCards;
  return Array.isArray(data) ? data : [];
});

// 校验相关状态（loading/pass/fail）
const checkResult = ref('');

// 卡片初始化
watch(
  () => [...cards.value],
  (newCards) => {
    if (!Array.isArray(newCards)) return;
    newCards.forEach((card) => {
      if (!card.data) card.data = {};
      if (!Array.isArray(card.data.options)) card.data.options = [];
      if (!Array.isArray(card.data.selectOptions)) card.data.selectOptions = [];
      if (!('showDropdown' in card)) card.showDropdown = false;
      if (!('isPresetEditing' in card)) card.isPresetEditing = false;
      if (!card.editableFields) {
        card.editableFields = {
          optionName: true,
          optionValue: true,
          optionUnit: true,
          optionCheckbox: true,
          optionActions: true,
          select: true
        };
      }
    });
  },
  { deep: true, immediate: true }
);

// 预设编辑中：勾选变化 => 自动保存到当前选中的下拉项
watch(
  () => selectedCard.value?.data.options,
  (newOptions) => {
    if (selectedCard.value?.isPresetEditing && newOptions && selectedCard.value.data.selectedValue) {
      const cardId = selectedCard.value.id;
      const selectedOption = selectedCard.value.data.selectOptions
        .find(opt => opt.label === selectedCard.value.data.selectedValue);
      
      if (selectedOption) {
        const checkedOptions = newOptions.filter(option => option.checked);
        cardStore.savePresetForSelectOption(cardId, selectedOption.id, checkedOptions);
      }
    }
  },
  { deep: true }
);

// 非预设编辑时：切换下拉项 => 应用已保存的预设
watch(
  () => selectedCard.value?.data.selectedValue,
  (newValue, oldValue) => {
    if (newValue && newValue !== oldValue && !selectedCard.value?.isPresetEditing) {
      const cardId = selectedCard.value.id;
      const selectedOption = selectedCard.value.data.selectOptions
        .find(opt => opt.label === newValue);
      
      if (selectedOption) {
        cardStore.applyPresetToCard(cardId, selectedOption.id);
      }
    }
  }
);

// 简化的卡片有效性检查
/* eslint-disable no-unused-vars */
const isCardValid = (card) => {
  /* eslint-enable no-unused-vars */
  return true;
};

// 检查配置
const checkConfigurationComplete = async () => {
  if (!isRootAdminMode.value) return;
  
  checkResult.value = 'loading';
  try {
    const validation = await cardStore.validateConfiguration();
    checkResult.value = validation.pass ? 'pass' : 'fail';
    
    if (checkResult.value === 'fail') {
      const firstInvalidCard = document.querySelector('.card-wrapper.invalid');
      if (firstInvalidCard) {
        firstInvalidCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      cardStore.saveSessionCards('root_admin');
    }
  } catch (error) {
    console.error('配置检查失败:', error);
    checkResult.value = 'fail';
  }
};

// 添加卡片
const addCard = () => {
  cardStore.addCard({
    data: {
      title: `新卡片 ${cards.value.length + 1}`,
      options: [{ id: Date.now(), name: null, value: null, unit: null, checked: false }],
      selectOptions: [{ id: Date.now(), label: null }],
      selectedValue: null
    },
    showDropdown: false
  });
};

// 添加选项行
const handleAddOption = (cardId, afterId) => {
  cardStore.addOption(cardId, afterId);
  const cardIndex = cards.value.findIndex(c => c.id === cardId);
  
  if (cardIndex !== -1) {
    const card = cards.value[cardIndex];
    const newOption = card.data.options[card.data.options.length - 1];
    
    if (newOption) {
      newOption.name = newOption.name || null;
      newOption.value = newOption.value || null;
      newOption.unit = newOption.unit || null;
    }
  }
};

// 选中卡片
const selectCard = (id) => {
  selectedCardId.value = id;
  deletingCardId.value = null;
};

// 预删除
const prepareDeleteCard = () => {
  if (selectedCardId.value) {
    deletingCardId.value = selectedCardId.value;
  }
};

const confirmDeleteCard = (id) => {
  cardStore.deleteCard(id);
};

// 标题编辑（允许在预设模式中使用）
const toggleTitleEditing = () => {
  if (selectedCardId.value) {
    cardStore.toggleTitleEditing(selectedCardId.value);
  }
};

// 编辑预设（独立，不调用基础按钮状态）
const togglePresetEditing = () => {
  if (selectedCardId.value) {
    cardStore.togglePresetEditing(selectedCardId.value);
  }
};

// 基础按钮：下拉编辑（预设模式中禁用）
const toggleSelectEditing = () => {
  if (selectedCardId.value) {
    cardStore.toggleSelectEditing(selectedCardId.value);
  }
};

// 切换可编辑字段（预设模式中禁用）
const toggleEditableField = (field) => {
  if (selectedCardId.value) {
    cardStore.toggleEditableField(selectedCardId.value, field);
  }
};

// 选项删
const handleDeleteOption = (cardId, optionId) => {
  cardStore.deleteOption(cardId, optionId);
};

// 下拉选项增删
const handleAddSelectOption = (cardId, label) => {
  cardStore.addSelectOption(cardId, label || null);
};

const handleDeleteSelectOption = (cardId, optionId) => {
  cardStore.deleteSelectOption(cardId, optionId);
};

// 下拉显示开关
const setShowDropdown = (cardId, value) => {
  cardStore.setShowDropdown(cardId, value);
};

// 备用：下拉值变化
const handleSelectedValueChange = (cardId, value) => {
  cardStore.updateCardSelectedValue(cardId, value);
};

// 备用：选项数组变化
const handleOptionsChange = (cardId, options) => {
  cardStore.updateCardOptions(cardId, options);
};

// 联动处理
const handleLinkage = (config) => {
  if (checkResult.value !== 'pass') {
    checkConfigurationComplete();
    return;
  }
  
  const sourceData = {
    cardCount: sessionSourceData.value.length,
    cards: sessionSourceData.value.map((card, index) => ({
      cardIndex: index,
      optionCount: card.data.options.length,
      title: card.data.title,
      options: card.data.options.map(opt => ({
        name: opt.name,
        value: opt.value,
        unit: opt.unit
      })),
      dropdown: {
        show: card.showDropdown,
        options: card.data.selectOptions,
        selectedValue: card.data.selectedValue
      },
      presetMappings: cardStore.presetMappings[card.id] || {}
    })),
    timestamp: new Date().toISOString()
  };
  
  coordinateMode({
    sourceModeId: 'root_admin',
    sourceData: sourceData,
    targetMode: config.targetMode,
    targetModeIds: config.targetModeIds,
    syncFields: config.sync,
    authFields: config.auth
  });
};
</script>

<style scoped>
.card-section {
  margin-bottom: 20px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

:deep(.mode-linkage-control) {
  margin-bottom: 20px;
  width: 100%;
  box-sizing: border-box;
}

.preset-editing-hint {
  margin: 10px 0;
  padding: 10px;
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
  color: #0d47a1;
  border-radius: 4px;
  font-size: 14px;
}

.card-controls {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.test-button {
  margin: 5px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #4caf50;
  color: white;
  cursor: pointer;
}

.test-button.active {
  background-color: #2196f3;
}

.test-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 配置检查按钮样式 */
.check-complete-btn {
  background-color: #ff9800;
}

.check-complete-btn.success {
  background-color: #4caf50;
}

.check-complete-btn.error {
  background-color: #f44336;
}

.check-complete-btn.loading {
  background-color: #9e9e9e;
}

.cards-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.card-wrapper {
  position: relative;
  width: 240px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.card-wrapper.selected {
  box-shadow: 0 0 0 3px #4caf50;
}

.card-wrapper.invalid {
  box-shadow: 0 0 0 3px #f44336;
}

.card-wrapper.deleting .universal-card {
  box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
  opacity: 0.9;
}

.delete-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 0, 0, 0.1);
  border-radius: inherit;
  display: flex;
  justify-content: flex-end;
  padding: 10px;
}

.delete-card-button {
  width: 30px;
  height: 30px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 仅隐藏“加/减按钮”，不影响名称/值/单位输入框 */
:deep(.hide-option-actions .option-actions) {
  display: none !important;
}
</style>
