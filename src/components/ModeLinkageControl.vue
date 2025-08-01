<template>
  <div class="mode-linkage-control">
    <!-- 模式选择下拉框 -->
    <div class="mode-selector">
      <button 
        class="selector-button" 
        @click="toggleModeDropdown"
      >
        {{ selectedMode || '选择模式' }}
        <i class="fa fa-chevron-down" :class="{ 'rotate': isModeDropdownOpen }"></i>
      </button>
      
      <!-- 下拉菜单 -->
      <div 
        class="mode-dropdown" 
        v-if="isModeDropdownOpen"
      >
        <!-- 本组件特有的"所有模式"选项 -->
        <div 
          class="mode-option" 
          @click="selectMode('所有模式')"
        >
          所有模式
        </div>
        
        <!-- 与App.vue采用相同方式引用数据源 -->
        <div 
          class="mode-option" 
          v-for="mode in modes" 
          :key="mode.id"
          @click="selectMode(mode.name)"
        >
          {{ mode.name }}
          <span v-if="mode.includeDataSection" class="data-badge">含数据</span>
        </div>
      </div>
    </div>

    <!-- 准备/取消联动按钮 -->
    <button 
      class="action-button prepare-button"
      :disabled="!selectedMode"
      @click="togglePrepareStatus"
    >
      {{ isInPrepareState ? '取消联动' : '准备联动' }}
    </button>

    <!-- 同步选项区域 -->
    <div class="sync-options">
      <div class="option-group">
        <span class="group-label">同步:</span>
        <div 
          class="option-item" 
          v-for="syncItem in syncOptions" 
          :key="syncItem.id"
        >
          <input 
            type="checkbox" 
            :id="`sync-${syncItem.id}`"
            v-model="syncItem.checked"
            :disabled="!isInPrepareState"
          >
          <label :for="`sync-${syncItem.id}`">{{ syncItem.name }}</label>
        </div>
      </div>

      <!-- 授权选项区域 -->
      <div class="option-group">
        <span class="group-label">授权:</span>
        <div 
          class="option-item" 
          v-for="authItem in authOptions" 
          :key="authItem.id"
        >
          <input 
            type="checkbox" 
            :id="`auth-${authItem.id}`"
            v-model="authItem.checked"
            :disabled="!isInPrepareState"
          >
          <label :for="`auth-${authItem.id}`">{{ authItem.name }}</label>
        </div>
      </div>
    </div>

    <!-- 确认联动按钮 -->
    <button 
      class="action-button confirm-button"
      :disabled="!canConfirmLinkage"
      @click="confirmLinkage"
    >
      确认联动
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
// 与App.vue完全相同的方式引入数据源
import { useCardStore } from '@/components/Data/store';

// 与App.vue完全相同的方式获取store实例
const cardStore = useCardStore();

// 组件内部独立状态（与App.vue无任何共享）
const isModeDropdownOpen = ref(false);
const selectedMode = ref('');
const isInPrepareState = ref(false);

// 与App.vue完全相同的方式获取模式列表
// 仅数据来源相同，状态完全独立
const modes = computed(() => cardStore.modes);

// 同步选项（组件私有状态）
const syncOptions = ref([
  { id: 1, name: '标题', checked: false },
  { id: 2, name: '选项名称', checked: false },
  { id: 3, name: '选项值', checked: false },
  { id: 4, name: '选项单位', checked: false }
]);

// 授权选项（组件私有状态）
const authOptions = ref([
  { id: 1, name: '选项名称', checked: false },
  { id: 2, name: '选项值', checked: false },
  { id: 3, name: '选项单位', checked: false },
  { id: 4, name: '复选框', checked: false }
]);

// 组件内部方法（不影响任何其他组件）
const toggleModeDropdown = () => {
  isModeDropdownOpen.value = !isModeDropdownOpen.value;
};

const selectMode = (modeName) => {
  selectedMode.value = modeName;
  isModeDropdownOpen.value = false;
};

const togglePrepareStatus = () => {
  if (isInPrepareState.value) {
    syncOptions.value.forEach(item => item.checked = false);
    authOptions.value.forEach(item => item.checked = false);
  }
  isInPrepareState.value = !isInPrepareState.value;
};

const canConfirmLinkage = computed(() => {
  if (!isInPrepareState.value || !selectedMode.value) return false;
  
  const hasSyncChecked = syncOptions.value.some(item => item.checked);
  const hasAuthChecked = authOptions.value.some(item => item.checked);
  
  return hasSyncChecked || hasAuthChecked;
});

const confirmLinkage = () => {
  const linkageConfig = {
    targetMode: selectedMode.value,
    targetModeIds: selectedMode.value === '所有模式' 
      ? modes.value.map(mode => mode.id)
      : [modes.value.find(mode => mode.name === selectedMode.value)?.id],
    sync: syncOptions.value.filter(item => item.checked).map(item => item.name),
    auth: authOptions.value.filter(item => item.checked).map(item => item.name),
    timestamp: new Date().toISOString()
  };
  
  emit('confirm-linkage', linkageConfig);
  resetLinkageState();
  alert(`已成功联动至 ${selectedMode.value}`);
};

const resetLinkageState = () => {
  selectedMode.value = '';
  isInPrepareState.value = false;
  syncOptions.value.forEach(item => item.checked = false);
  authOptions.value.forEach(item => item.checked = false);
};

// 仅监听自身引用的数据变化，不与其他组件产生关联
watch(modes, (newModes) => {
  if (selectedMode.value && selectedMode.value !== '所有模式') {
    const modeExists = newModes.some(mode => mode.name === selectedMode.value);
    if (!modeExists) {
      selectedMode.value = '';
      isInPrepareState.value = false;
    }
  }
});

const emit = defineEmits(['confirm-linkage']);
</script>

<style scoped>
/* 样式保持不变 */
.mode-linkage-control {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  flex-wrap: wrap;
}

.mode-selector {
  position: relative;
  min-width: 120px;
}

.selector-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.selector-button:hover {
  border-color: #409eff;
}

.mode-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.mode-option {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 14px;
}

.mode-option:hover {
  background-color: #f5f7fa;
}

.mode-option:first-child {
  border-bottom: 1px solid #e4e7ed;
}

.data-badge {
  font-size: 12px;
  color: #2196f3;
  margin-left: 6px;
  font-weight: normal;
}

.action-button {
  padding: 6px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.prepare-button {
  background-color: #409eff;
  color: #fff;
}

.prepare-button:hover:not(:disabled) {
  background-color: #66b1ff;
}

.prepare-button:disabled {
  background-color: #c0ccda;
  cursor: not-allowed;
}

.confirm-button {
  background-color: #67c23a;
  color: #fff;
}

.confirm-button:hover:not(:disabled) {
  background-color: #85ce61;
}

.confirm-button:disabled {
  background-color: #c2e7b0;
  cursor: not-allowed;
}

.sync-options {
  display: flex;
  gap: 20px;
  flex: 1;
  min-width: 400px;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.option-item {
  display: inline-flex;
  align-items: center;
  margin-right: 12px;
  font-size: 14px;
  color: #303133;
}

.option-item input {
  margin-right: 4px;
  cursor: pointer;
}

.option-item input:disabled + label {
  color: #c0ccda;
  cursor: not-allowed;
}

.fa-chevron-down {
  transition: transform 0.2s;
  margin-left: 6px;
  font-size: 12px;
}

.rotate {
  transform: rotate(180deg);
}

@media (max-width: 768px) {
  .mode-linkage-control {
    flex-direction: column;
    align-items: stretch;
  }
  
  .sync-options {
    min-width: auto;
    flex-direction: column;
    gap: 8px;
  }
  
  .option-group {
    flex-wrap: wrap;
  }
}
</style>
