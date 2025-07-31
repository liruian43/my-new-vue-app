<template>
  <div class="app-container">
    <div class="nav-container">
      <!-- 左上角模式切换下拉菜单 -->
      <div class="mode-switcher">
        <select 
          v-model="currentModeId" 
          @change="handleModeChange"
          class="mode-select"
          :disabled="modes.length === 0"
        >
          <option value="">选择模式</option>
          <option 
            v-for="mode in modes" 
            :key="mode.id" 
            :value="mode.id"
          >
            {{ mode.name }} 
            <span v-if="mode.includeDataSection" class="data-badge">含数据</span>
          </option>
        </select>
      </div>
      
      <h1>通用卡片管理系统</h1>
    </div>
    <router-view />
  </div>
</template>

<script setup>
import { onMounted, computed, watch } from "vue"
import { useCardStore } from './components/Data/store';

// 获取卡片存储实例
const cardStore = useCardStore();

// 从store获取模式列表和当前模式ID
const modes = computed(() => cardStore.modes);
const currentModeId = computed({
  get: () => cardStore.currentModeId,
  set: (value) => cardStore.setCurrentMode(value)
});

// 处理模式切换
const handleModeChange = () => {
  console.log(`切换到模式: ${currentModeId.value}`);
  // 切换模式后会自动触发相关组件的响应式更新
};

onMounted(() => {
  console.log("App.vue 已挂载");
  // 如果有模式但未选择当前模式，自动选择第一个
  if (modes.value.length > 0 && !currentModeId.value) {
    currentModeId.value = modes.value[0].id;
  }
});

// 监听模式列表变化，确保始终有一个选中的模式
watch(modes, (newModes) => {
  if (newModes.length > 0 && !currentModeId.value) {
    currentModeId.value = newModes[0].id;
  } else if (newModes.length === 0) {
    currentModeId.value = null;
  }
});
</script>

<style>
.app-container {
  padding: 20px;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nav-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-bottom: 20px;
  position: relative;
}

/* 模式切换样式 */
.mode-switcher {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
}

.mode-select {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 14px;
  background-color: white;
  cursor: pointer;
}

.mode-select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.data-badge {
  font-size: 12px;
  color: #2196f3;
  margin-left: 6px;
  font-weight: normal;
}

h1 {
  margin: 0;
  color: #333;
}
</style>
