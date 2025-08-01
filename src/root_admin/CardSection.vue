<template>
  <div class="card-section">
    <!-- 联动控制组件：仅在/root_admin及其子路径显示 -->
    <ModeLinkageControl 
      v-if="isRootAdminRoute"
      @confirm-linkage="handleLinkage"
    />

    <!-- 顶部控制按钮 -->
    <div class="card-controls">
      <button class="test-button" @click="addCard">添加卡片</button>
      <button
        class="test-button"
        @click="prepareDeleteCard"
        :disabled="!selectedCardId"
      >
        删除卡片
      </button>
      <button
        class="test-button"
        @click="toggleTitleEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isTitleEditing }"
      >
        {{ selectedCard?.isTitleEditing ? "完成标题编辑" : "编辑标题" }}
      </button>
      <button
        class="test-button"
        @click="toggleOptionsEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isOptionsEditing }"
      >
        {{ selectedCard?.isOptionsEditing ? "完成选项编辑" : "编辑选项" }}
      </button>
      <button
        class="test-button"
        @click="toggleSelectEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isSelectEditing }"
      >
        {{ selectedCard?.isSelectEditing ? "完成下拉菜单编辑" : "编辑下拉菜单" }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionName')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionName }"
      >
        {{
          selectedCard?.editableFields.optionName ? "完成名称编辑" : "编辑选项名称"
        }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionValue')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionValue }"
      >
        {{
          selectedCard?.editableFields.optionValue ? "完成值编辑" : "编辑选项值"
        }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionUnit')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionUnit }"
      >
        {{
          selectedCard?.editableFields.optionUnit ? "完成单位编辑" : "编辑选项单位"
        }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionCheckbox')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionCheckbox }"
      >
        {{
          selectedCard?.editableFields.optionCheckbox ? "隐藏选项复选框" : "显示选项复选框"
        }}
      </button>
      <button
        class="test-button"
        @click="() => toggleEditableField('optionActions')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionActions }"
      >
        {{
          selectedCard?.editableFields.optionActions ? "隐藏选项按钮" : "显示选项按钮"
        }}
      </button>
    </div>

    <!-- 卡片列表 -->
    <div class="cards-container">
      <div
        v-for="card in cards"
        :key="card.id"
        class="card-wrapper"
        :class="{ deleting: deletingCardId === card.id, selected: selectedCardId === card.id }"
        @click.stop="selectCard(card.id)"
      >
        <UniversalCard
          v-model:modelValue="card.data.title"
          v-model:options="card.data.options"
          v-model:selectedValue="card.data.selectedValue"
          :selectOptions="card.data.selectOptions"
          :showDropdown="card.showDropdown"
          :isTitleEditing="card.isTitleEditing"
          :isOptionsEditing="card.isOptionsEditing"
          :isSelectEditing="card.isSelectEditing"
          :editableFields="card.editableFields"
          @add-option="(afterId) => handleAddOption(card.id, afterId)"
          @delete-option="(optionId) => handleDeleteOption(card.id, optionId)"
          @add-select-option="(label) => handleAddSelectOption(card.id, label)"
          @delete-select-option="(optionId) => handleDeleteSelectOption(card.id, optionId)"
          @dropdown-toggle="(value) => setShowDropdown(card.id, value)"
          :class="{ selected: selectedCardId === card.id }"
        />

        <div v-if="deletingCardId === card.id" class="delete-overlay">
          <button class="delete-card-button" @click.stop="confirmDeleteCard(card.id)">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCardStore } from '../components/Data/store';
import UniversalCard from '../components/UniversalCard/UniversalCard.vue';
// 引入联动控制组件
import ModeLinkageControl from '../components/ModeLinkageControl.vue';
// 引入模式协调工具和路由
import { coordinateMode } from '../utils/modeCoordinator';
import { useRoute } from 'vue-router'; // 引入路由钩子

// 路由判断逻辑：仅匹配/root_admin及其所有子路径
const route = useRoute();
const isRootAdminRoute = computed(() => {
  // 正则表达式精确匹配：
  // ^/root_admin$ 匹配精确的/root_admin路径
  // ^/root_admin/ 匹配所有以/root_admin/开头的子路径
  return /^\/root_admin($|\/)/.test(route.path);
});

const cardStore = useCardStore();

// 从store获取状态
const cards = computed(() => cardStore.cards);
const selectedCardId = computed({
  get: () => cardStore.selectedCardId,
  set: (value) => cardStore.selectedCardId = value
});
const deletingCardId = computed({
  get: () => cardStore.deletingCardId,
  set: (value) => cardStore.deletingCardId = value
});
const selectedCard = computed(() => cardStore.selectedCard);

// 添加卡片
const addCard = () => {
  cardStore.addCard({
    data: {
      title: `新卡片 ${cards.value.length + 1}`,
      options: [{ id: 1, name: "新选项", value: "", unit: "", checked: false }],
      selectOptions: [{ id: 1, label: "新选项" }],
      selectedValue: "",
    }
  });
};

// 选择卡片
const selectCard = (id) => {
  selectedCardId.value = id;
  deletingCardId.value = null;
};

// 准备删除卡片
const prepareDeleteCard = () => {
  if (selectedCardId.value) {
    deletingCardId.value = selectedCardId.value;
  }
};

// 确认删除卡片
const confirmDeleteCard = (id) => {
  cardStore.deleteCard(id);
};

// 切换标题编辑状态
const toggleTitleEditing = () => {
  if (selectedCardId.value) {
    cardStore.toggleTitleEditing(selectedCardId.value);
  }
};

// 切换选项编辑状态
const toggleOptionsEditing = () => {
  if (selectedCardId.value) {
    cardStore.toggleOptionsEditing(selectedCardId.value);
  }
};

// 切换下拉菜单编辑状态
const toggleSelectEditing = () => {
  if (selectedCardId.value) {
    cardStore.toggleSelectEditing(selectedCardId.value);
  }
};

// 切换可编辑字段
const toggleEditableField = (field) => {
  if (selectedCardId.value) {
    cardStore.toggleEditableField(selectedCardId.value, field);
  }
};

// 添加选项
const handleAddOption = (cardId, afterId) => {
  cardStore.addOption(cardId, afterId);
};

// 删除选项
const handleDeleteOption = (cardId, optionId) => {
  cardStore.deleteOption(cardId, optionId);
};

// 添加下拉选项
const handleAddSelectOption = (cardId, label) => {
  cardStore.addSelectOption(cardId, label);
};

// 删除下拉选项
const handleDeleteSelectOption = (cardId, optionId) => {
  cardStore.deleteSelectOption(cardId, optionId);
};

// 设置下拉菜单显示状态
const setShowDropdown = (cardId, value) => {
  cardStore.setShowDropdown(cardId, value);
};

// 处理联动逻辑
const handleLinkage = (config) => {
  // 收集完整的root_admin数据
  const sourceData = {
    cards: cards.value.map(card => ({
      id: card.id,
      title: card.data.title,
      options: card.data.options.map(option => ({
        id: option.id,
        name: option.name,
        value: option.value,
        unit: option.unit,
        checked: option.checked
      })),
      selectOptions: card.data.selectOptions.map(option => ({
        id: option.id,
        label: option.label
      })),
      structure: {
        optionCount: card.data.options.length,
        hasSelect: card.data.selectOptions.length > 0
      }
    })),
    cardCount: cards.value.length,
    timestamp: new Date().toISOString()
  };
  
  // 调用协调工具执行同步
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

/* 为联动组件添加间距 */
:deep(.mode-linkage-control) {
  margin-bottom: 20px;
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

.cards-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.card-wrapper {
  position: relative;
  width: 240px;
}

.card-wrapper.selected {
  box-shadow: 0 0 0 3px #4caf50;
}

.card-wrapper.deleting .universal-card {
  box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
  opacity: 0.9;
}

.delete-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
</style>
    