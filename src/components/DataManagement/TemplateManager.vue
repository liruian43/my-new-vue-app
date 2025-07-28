<template>
  <div class="template-manager">
    <h3>模板管理</h3>

    <div class="template-actions">
      <button
        @click="createTemplateFromCurrent"
        class="action-button"
        :disabled="!currentCard"
      >
        从当前卡片创建模板
      </button>
    </div>

    <div class="templates-list">
      <div v-if="templates.length === 0" class="empty-templates">暂无模板</div>

      <div
        v-for="template in templates"
        :key="template.id"
        class="template-item"
      >
        <div class="template-info">
          <h4>{{ template.name }}</h4>
          <p>创建于: {{ formatDate(template.createdAt) }}</p>
          <p>包含 {{ template.data.options?.length || 0 }} 个选项</p>
        </div>

        <div class="template-buttons">
          <button
            @click="applyTemplateToCard(template.id)"
            class="action-button small"
          >
            应用
          </button>
          <button
            @click="deleteTemplate(template.id)"
            class="action-button small danger"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";
import { useTemplates } from "../../composables/useTemplates";

const props = defineProps({
  currentCard: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["templateApplied"]);

const { templates, createTemplate, applyTemplate, deleteTemplate } =
  useTemplates();

const createTemplateFromCurrent = () => {
  if (!props.currentCard) return;

  const newTemplate = createTemplate(props.currentCard);
  alert(`模板 "${newTemplate.name}" 创建成功!`);
};

const applyTemplateToCard = (templateId) => {
  const templateData = applyTemplate(templateId);
  if (templateData) {
    emit("templateApplied", templateData);
  }
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString();
};
</script>

<style scoped>
.template-manager {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.template-actions {
  margin-bottom: 1rem;
}

.templates-list {
  max-height: 300px;
  overflow-y: auto;
}

.template-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
}

.template-item:last-child {
  border-bottom: none;
}

.template-info {
  flex: 1;
}

.template-info h4 {
  margin: 0 0 0.25rem 0;
}

.template-info p {
  margin: 0.25rem 0;
  font-size: 0.8rem;
  color: #666;
}

.template-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-button.small {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.action-button.danger {
  background-color: #f44336;
}

.action-button.danger:hover {
  background-color: #d32f2f;
}

.empty-templates {
  padding: 1rem;
  text-align: center;
  color: #999;
}
</style>
