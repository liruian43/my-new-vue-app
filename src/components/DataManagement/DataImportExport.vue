<template>
  <div class="data-management">
    <h3>数据管理</h3>

    <div class="action-buttons">
      <button @click="handleExport" class="action-button">导出数据</button>
      <button @click="triggerImport" class="action-button">导入数据</button>
      <input
        type="file"
        ref="fileInput"
        @change="handleImport"
        accept=".json"
        style="display: none"
      />
    </div>

    <div v-if="statusMessage" class="status-message" :class="statusType">
      {{ statusMessage }}
    </div>

    <div class="storage-info">
      <p>已使用存储: {{ storageUsed }}</p>
      <p>卡片数量: {{ cardCount }}</p>
      <p>模板数量: {{ templateCount }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useDataManagement } from "../../composables/useDataManagement";

const { appData, exportData, importData } = useDataManagement();
const fileInput = ref(null);
const statusMessage = ref("");
const statusType = ref("");

const cardCount = computed(() => appData.value.cards.length);
const templateCount = computed(() => appData.value.templates.length);
const storageUsed = computed(() => {
  const dataSize = JSON.stringify(appData.value).length;
  return `${(dataSize / 1024).toFixed(2)} KB`;
});

const triggerImport = () => {
  fileInput.value.click();
};

const handleImport = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    statusMessage.value = "正在导入数据...";
    statusType.value = "info";

    await importData(file);

    statusMessage.value = "数据导入成功!";
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `导入失败: ${error.message}`;
    statusType.value = "error";
  } finally {
    event.target.value = ""; // 重置input
    setTimeout(() => {
      statusMessage.value = "";
      statusType.value = "";
    }, 3000);
  }
};

const handleExport = () => {
  const { uri, fileName } = exportData();

  const link = document.createElement("a");
  link.href = uri;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>

<style scoped>
.data-management {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
}

.action-button {
  padding: 0.5rem 1rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.action-button:hover {
  background-color: #45a049;
}

.status-message {
  padding: 0.5rem;
  margin: 0.5rem 0;
  border-radius: 4px;
}

.status-message.info {
  background-color: #e7f3fe;
  color: #2196f3;
}

.status-message.success {
  background-color: #e8f5e9;
  color: #4caf50;
}

.status-message.error {
  background-color: #ffebee;
  color: #f44336;
}

.storage-info {
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #666;
}
</style>
