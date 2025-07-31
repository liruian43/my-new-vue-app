<template>
  <div class="mode-management">
    <div class="mode-controls">
      <!-- 新建模式控制 -->
      <button 
        class="mode-button" 
        @click="toggleCreateMode"
        :class="{ active: isCreating }"
      >
        {{ isCreating ? '创建完成' : '新建模式' }}
      </button>
      
      <!-- 删除模式控制 -->
      <button 
        class="mode-button" 
        @click="toggleDeleteMode"
        :class="{ active: isDeleting, danger: isDeleting }"
        :disabled="modes.length <= 0"
      >
        {{ isDeleting ? '删除完成' : '删除模式' }}
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
        <div v-if="isDeleting" class="mode-checkbox">
          <input 
            type="checkbox" 
            v-model="selectedModeIds" 
            :value="mode.id"
          >
        </div>
        <div 
          class="mode-name"
          :class="{ active: mode.id === currentModeId }"
          @click="switchMode(mode.id)"
        >
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
import { ref, computed, watch } from 'vue';
import { useCardStore } from '../components/Data/store';
import { v4 as uuidv4 } from 'uuid'; // 用于生成唯一ID，需要安装uuid包

const cardStore = useCardStore();

// 状态管理
const isCreating = ref(false);
const isDeleting = ref(false);
const newModeName = ref('');
const newModeWithData = ref(false);
const selectedModeIds = ref([]);

// 从store获取模式数据
const modes = computed(() => cardStore.modes);
const currentModeId = computed({
  get: () => cardStore.currentModeId,
  set: (value) => cardStore.setCurrentMode(value)
});

// 切换创建模式状态
const toggleCreateMode = () => {
  if (isCreating.value) {
    // 退出创建模式时清空表单
    newModeName.value = '';
    newModeWithData.value = false;
  }
  isCreating.value = !isCreating.value;
  // 确保删除模式处于关闭状态
  isDeleting.value = false;
};

// 切换删除模式状态
const toggleDeleteMode = () => {
  if (isDeleting.value) {
    // 退出删除模式时清空选择
    selectedModeIds.value = [];
  }
  isDeleting.value = !isDeleting.value;
  // 确保创建模式处于关闭状态
  isCreating.value = false;
};

// 创建新模式
const createMode = () => {
  if (!newModeName.value.trim()) return;
  
  const newMode = {
    id: `mode-${uuidv4()}`,
    name: newModeName.value.trim(),
    includeDataSection: newModeWithData.value,
    // 默认层级为中间级(2)，root为1
    level: 2,
    // 默认权限：基础卡片区操作权限
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
    // 初始卡片数据为空
    cardData: []
  };
  
  cardStore.addMode(newMode);
  
  // 自动切换到新模式
  currentModeId.value = newMode.id;
  
  // 重置表单并退出创建模式
  newModeName.value = '';
  newModeWithData.value = false;
  isCreating.value = false;
};

// 切换模式
const switchMode = (modeId) => {
  if (!isDeleting.value) { // 非删除状态下才允许切换
    currentModeId.value = modeId;
  }
};

// 监听删除模式状态变化
watch(isDeleting, (newVal) => {
  if (!newVal) {
    selectedModeIds.value = [];
  }
});

// 删除选中的模式
watch(isDeleting, (newVal) => {
  if (!newVal && selectedModeIds.value.length > 0) {
    if (confirm(`确定要删除选中的${selectedModeIds.value.length}个模式吗？`)) {
      cardStore.deleteModes(selectedModeIds.value);
    }
    selectedModeIds.value = [];
  }
});
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

.mode-checkbox {
}

.mode-name {
  padding: 6px 12px;
  background-color: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mode-name.active {
  background-color: #42b983;
  color: white;
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
