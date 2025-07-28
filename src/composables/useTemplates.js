import { computed } from "vue";
import { useDataManagement } from "./useDataManagement";

export function useTemplates() {
  const { appData } = useDataManagement();

  const templates = computed(() => appData.value.templates);

  const createTemplate = (cardData) => {
    const newTemplate = {
      id: Date.now(),
      name: `Template ${templates.value.length + 1}`,
      createdAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(cardData)),
    };

    appData.value.templates.push(newTemplate);
    return newTemplate;
  };

  const applyTemplate = (templateId) => {
    const template = templates.value.find((t) => t.id === templateId);
    if (!template) return null;

    return JSON.parse(JSON.stringify(template.data));
  };

  const deleteTemplate = (templateId) => {
    const index = templates.value.findIndex((t) => t.id === templateId);
    if (index !== -1) {
      appData.value.templates.splice(index, 1);
      return true;
    }
    return false;
  };

  return {
    templates,
    createTemplate,
    applyTemplate,
    deleteTemplate,
  };
}
