<template>
  <div class="home-page" @click="handleContainerClick">
    <!-- 加载状态指示 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">加载中...</div>
    </div>
    
    <!-- 错误提示 -->
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <!-- 正常内容 -->
    <div v-else class="component-container">
      <CardSection />
      <DataSection />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useCardStore } from '../components/Data/store';
import CardSection from './CardSection.vue';
import DataSection from './DataSection.vue';

const cardStore = useCardStore();
const loading = ref(true);
const error = ref(null);

// 初始化
onMounted(() => {
  loadAllData().finally(() => {
    loading.value = false;
  });
});

// 加载所有数据
const loadAllData = async () => {
  try {
    await cardStore.loadCardsFromLocal();
    alert('数据已从本地存储加载');
    
    // 如果没有数据，添加一个默认卡片
    if (cardStore.cards.length === 0) {
      cardStore.addCard({
        data: {
          title: '默认卡片',
          options: [{ id: 1, name: "选项1", value: "100", unit: "kg", checked: false }],
          selectOptions: [{ id: 1, label: "选项一" }],
          selectedValue: "",
        }
      });
    }
  } catch (err) {
    error.value = '加载数据失败: ' + err.message;
    alert('加载数据失败: ' + err.message);
    console.error('加载数据失败:', err);
    
    // 如果加载失败，添加一个默认卡片
    cardStore.addCard({
      data: {
        title: '默认卡片',
        options: [{ id: 1, name: "选项1", value: "100", unit: "kg", checked: false }],
        selectOptions: [{ id: 1, label: "选项一" }],
        selectedValue: "",
      }
    });
  }
};

// 处理容器点击
const handleContainerClick = (event) => {
  const isButtonClick = event.target.closest('.test-button') !== null;
  const isCardControlsClick = event.target.closest('.card-controls') !== null;
  if (!isButtonClick && !isCardControlsClick) {
    cardStore.selectedCardId = null;
    cardStore.deletingCardId = null;
  }
};
</script>

<style>
/* 加载状态样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  font-size: 24px;
  color: #333;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-message {
  padding: 20px;
  background-color: #ffebee;
  color: #b71c1c;
  border-radius: 4px;
  margin: 20px;
  text-align: center;
  font-size: 16px;
}

.component-container > * {
  margin-bottom: 10px;
}
</style>  