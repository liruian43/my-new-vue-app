<template>
  <div class="mode-management">
    <div class="mode-controls">
      <!-- 新建模式控制 -->
      <button 
        class="mode-button" 
        @click="toggleCreateMode"
        :class="{ active: isCreating }"
      >
        {{ isCreating ? '取消创建' : '新建模式' }}
      </button>
      
      <!-- 删除模式控制 -->
      <button 
        class="mode-button" 
        @click="toggleDeleteMode"
        :class="{ active: isDeleting, danger: isDeleting }"
        :disabled="modes.length <= 0"
      >
        {{ isDeleting ? '确认删除' : '删除模式' }}
      </button>
    </div>
    
    <!-- 创建模式表单 -->
    <div v-if="isCreating" class="create-mode-form">
      <input 
        type="text" 
        v-model="newModeName" 
        placeholder="请输入模式名称"
        class="mode-name-input"
      >
      <label class="data-function-checkbox">
        <input 
          type="checkbox" 
          v-model="newModeWithData"
        >
        是否为该模式应用数据功能
      </label>
      <button 
        class="confirm-create-button"
        @click="createMode"
        :disabled="!newModeName.trim()"
      >
        确认创建
      </button>
    </div>
    
    <!-- 模式列表 -->
    <div class="mode-list">
      <div 
        v-for="mode in modes" 
        :key="mode.id"
        class="mode-item"
      >
        <!-- 仅在删除模式下显示复选框 -->
        <div v-if="isDeleting" class="mode-checkbox">
          <input 
            type="checkbox" 
            v-model="selectedModeIds" 
            :value="mode.id"
          >
        </div>
        <!-- 模式名称仅作为文本展示 -->
        <div class="mode-name">
          {{ mode.name }}
          <span v-if="mode.includeDataSection" class="data-badge">含数据区</span>
        </div>
      </div>
      
      <div v-if="modes.length === 0 && !isCreating" class="empty-state">
        暂无模式，请点击"新建模式"创建
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../components/Data/store';
import { v4 as uuidv4 } from 'uuid';

const cardStore = useCardStore();

// 仅保留必要的状态
const isCreating = ref(false);
const isDeleting = ref(false);
const newModeName = ref('');
const newModeWithData = ref(false);
const selectedModeIds = ref([]);

// 仅获取模式列表数据
const modes = computed(() => cardStore.modes);

// 切换创建模式状态
const toggleCreateMode = () => {
  if (isCreating.value) {
    // 取消创建时清空表单
    newModeName.value = '';
    newModeWithData.value = false;
  }
  isCreating.value = !isCreating.value;
  isDeleting.value = false; // 确保删除模式关闭
};

// 切换删除模式状态
const toggleDeleteMode = () => {
  if (isDeleting.value) {
    // 确认删除选中的模式
    if (selectedModeIds.value.length > 0) {
      if (confirm(`确定要删除选中的${selectedModeIds.value.length}个模式吗？`)) {
        cardStore.deleteModes(selectedModeIds.value);
      }
    }
    // 退出删除模式时清空选择
    selectedModeIds.value = [];
  }
  isDeleting.value = !isDeleting.value;
  isCreating.value = false; // 确保创建模式关闭
};

// 创建新模式
const createMode = () => {
  if (!newModeName.value.trim()) return;
  
  const newMode = {
    id: `mode-${uuidv4()}`,
    name: newModeName.value.trim(),
    includeDataSection: newModeWithData.value,
    // 保留必要的基础属性
    level: 2,
    permissions: {
      card: {
        addCard: true,
        deleteCard: true,
        editTitle: true,
        editOptions: true
      },
      data: newModeWithData.value ? {
        view: true,
        save: false,
        export: false,
        import: false
      } : {},
      mode: {
        create: false,
        delete: false,
        assignPermissions: false
      }
    },
    cardData: []
  };
  
  cardStore.addMode(newMode);
  
  // 重置表单并退出创建模式
  newModeName.value = '';
  newModeWithData.value = false;
  isCreating.value = false;
};
</script>

<style scoped>
.mode-management {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 10px 0;
}

.mode-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.mode-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #42b983;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s;
}

.mode-button.active {
  background-color: #2c3e50;
}

.mode-button.danger {
  background-color: #e74c3c;
}

.mode-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.create-mode-form {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
  flex-wrap: wrap;
}

.mode-name-input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex-grow: 1;
  min-width: 200px;
}

.data-function-checkbox {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.confirm-create-button {
  padding: 8px 16px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-create-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.mode-list {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-name {
  padding: 6px 12px;
  background-color: #f0f0f0;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: default; /* 不可点击 */
}

.data-badge {
  font-size: 12px;
  background-color: #2196f3;
  color: white;
  padding: 1px 6px;
  border-radius: 10px;
}

.empty-state {
  color: #888;
  padding: 10px;
  font-style: italic;
}
</style>
