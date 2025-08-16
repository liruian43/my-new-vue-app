<template>
  <div class="mode-management">
    <!-- 原模式管理功能区域，添加了容器和边框 -->
    <div class="mode-management-container">
      <div class="mode-controls">
        <!-- 新建模式按钮 -->
        <button 
          class="mode-button" 
          @click="toggleCreateMode"
          :class="{ active: isCreating }"
        >
          {{ isCreating ? '取消创建' : '新建模式' }}
        </button>
        
        <!-- 删除模式按钮 -->
        <button 
          class="mode-button" 
          @click="toggleDeleteMode"
          :class="{ danger: isDeleting, active: isDeleting }"
          :disabled="filteredModes.length <= 0"
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
          @keyup.enter="createMode"
        >
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
          v-for="mode in filteredModes"
          :key="mode.id"
          class="mode-item"
        >
          <!-- 复选框（仅删除模式显示） -->
          <div v-if="isDeleting" class="mode-checkbox">
            <input 
              type="checkbox" 
              v-model="selectedModeIds" 
              :value="mode.id"
            >
          </div>
          <!-- 模式名称 -->
          <div class="mode-name">
            {{ mode.name }}
          </div>
        </div>
        
        <div v-if="filteredModes.length === 0 && !isCreating" class="empty-state">
          暂无创建的模式，请点击"新建模式"
        </div>
      </div>
    </div>
    
    <!-- 添加的ModeLinkageControl组件 -->
    <div class="mode-linkage-container">
      <ModeLinkageControl 
        v-if="isRootAdminMode" 
        @confirm-linkage="handleLinkage" 
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCardStore } from '../components/Data/store';
import { v4 as uuidv4 } from 'uuid';
// 移除直接的utils导入，改为通过store调用
import ModeLinkageControl from '../components/ModeLinkageControl.vue';
import { useRoute } from 'vue-router';

// 路由判断逻辑：仅匹配/root_admin及其所有子路径
const route = useRoute();

// 模式判断
const isRootAdminMode = computed(() => {
  return /^\/root_admin($|\/)/.test(route.path);
});

// 初始化存储
const cardStore = useCardStore();

// 状态管理
const isCreating = ref(false);
const isDeleting = ref(false);
const newModeName = ref('');
const selectedModeIds = ref([]);
const modeLoading = ref(false);

// 过滤：只显示用户创建的模式（排除主模式root_admin）
const filteredModes = computed(() => {
  return cardStore.modes.filter(mode => mode.id !== 'root_admin');
});

// 初始化加载模式列表
onMounted(() => {
  if (cardStore.modes.length === 0) {
    modeLoading.value = true;
    // 确保存储已初始化
    cardStore.initialize().then(() => {
      modeLoading.value = false;
    }).catch(() => {
      modeLoading.value = false;
    });
  }
});

// 切换创建模式
const toggleCreateMode = () => {
  if (isCreating.value) {
    newModeName.value = ''; // 重置输入
  }
  isCreating.value = !isCreating.value;
  isDeleting.value = false;
  selectedModeIds.value = [];
};

// 切换删除模式
const toggleDeleteMode = () => {
  if (isDeleting.value) {
    handleDeleteSelectedModes();
  } else {
    selectedModeIds.value = []; // 重置选择
  }
  isDeleting.value = !isDeleting.value;
  isCreating.value = false;
};

// 处理删除选中的模式（仅删除模式本身，不涉及卡片）
const handleDeleteSelectedModes = () => {
  if (selectedModeIds.value.length === 0) return;
  
  // 严格过滤：排除主模式（双重保险）
  const modesToDelete = selectedModeIds.value.filter(id => id !== 'root_admin');
  if (modesToDelete.length === 0) {
    selectedModeIds.value = [];
    return;
  }
  
  if (confirm(`确定要删除这${modesToDelete.length}个模式吗？`)) {
    modeLoading.value = true;
    try {
      // 调用store删除模式（仅模式记录）
      cardStore.deleteModes(modesToDelete);
      // 通过store删除对应的模式页面文件（原直接调用deleteModePage）
      modesToDelete.forEach(modeId => {
        cardStore.deleteModePage(modeId);
      });
      // 重置状态
      selectedModeIds.value = [];
    } catch (error) {
      console.error('删除模式失败:', error);
      alert('删除模式失败，请重试');
    } finally {
      modeLoading.value = false;
    }
  }
};

// 创建新模式
const createMode = () => {
  if (!newModeName.value.trim()) {
    alert('请输入模式名称');
    return;
  }
  
  modeLoading.value = true;
  try {
    const modeUuid = uuidv4();
    const newMode = {
      id: `mode-${modeUuid}`, // 确保与主模式区分
      name: newModeName.value.trim(),
      level: 2, // 二级模式（用户创建）
      permissions: {
        card: { addCard: true, deleteCard: true, editTitle: true, editOptions: true },
        data: { view: true, save: true, export: false, import: true },
        mode: { create: false, delete: false, assignPermissions: false, sync: false },
        authorize: { canAuthorize: false }
      },
      routePath: `/mode/${modeUuid}`,
      createdAt: new Date().toISOString()
    };
    
    // 添加到存储
    const createdMode = cardStore.addMode(newMode);
    if (createdMode) {
      // 通过store生成模式页面（原直接调用generateModePage）
      cardStore.generateModePage(createdMode);
      // 重置表单
      newModeName.value = '';
      isCreating.value = false;
    }
  } catch (error) {
    console.error('创建模式失败:', error);
    alert('创建模式失败，请重试');
  } finally {
    modeLoading.value = false;
  }
};

// 联动处理（从CardSection.vue迁移过来的方法）
const handleLinkage = (config) => {
  // 会话级源数据区数据
  const sessionSourceData = computed(() => {
    const data = cardStore.currentModeSessionCards;
    return Array.isArray(data) ? data : [];
  });
  
  if (cardStore.checkResult !== 'pass') {
    // 这里简化处理，实际应该调用配置检查方法
    cardStore.checkResult = 'loading';
    setTimeout(() => {
      cardStore.checkResult = 'pass';
    }, 500);
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
  
  // 通过store调用联动处理（原直接调用coordinateMode）
  cardStore.coordinateMode({
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
.mode-management {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 10px 0;
}

/* 原模式管理功能的容器样式 */
.mode-management-container {
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 20px;
  background-color: #fcfcfc;
}

.mode-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  align-items: center;
}

.mode-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #42b983;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.mode-button:hover {
  opacity: 0.9;
}

.mode-button.danger {
  background-color: #e74c3c;
}

.mode-button.active {
  transform: scale(0.98);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.mode-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.create-mode-form {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding: 10px;
  background: none;
  border: 1px dashed #ccc;
  border-radius: 4px;
}

.mode-name-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex-grow: 1;
  min-width: 200px;
  font-size: 14px;
}

.mode-name-input:focus {
  outline: none;
  border-color: #2196f3;
}

.confirm-create-button {
  padding: 8px 16px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 14px;
}

.confirm-create-button:hover:not(:disabled) {
  background-color: #1976d2;
}

.confirm-create-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.mode-list {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px; /* 模式名称之间的间距 */
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 6px; /* 复选框与名称的间距 */
  padding: 6px 10px;
  border-radius: 4px;
}

.mode-checkbox {
  margin: 0;
}

.mode-name {
  padding: 4px 10px;
  color: #333;
  border: 1px solid #eee;
  border-radius: 4px;
  font-size: 14px;
}

.empty-state {
  color: #888;
  padding: 15px;
  font-style: italic;
  font-size: 14px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

/* 模式联动控制组件的容器样式 */
.mode-linkage-container {
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  background-color: #f9f9f9;
}

@media (max-width: 768px) {
  .mode-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .mode-button {
    width: 100%;
  }
  
  .create-mode-form {
    flex-direction: column;
    align-items: stretch;
  }
  
  .mode-name-input {
    min-width: auto;
    width: 100%;
  }
}
</style>
