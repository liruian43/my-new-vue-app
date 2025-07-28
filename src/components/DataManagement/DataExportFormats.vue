<template>
  <div class="export-formats">
    <h4>导出格式</h4>
    <div class="format-options">
      <button @click="exportAs('json')" class="format-button">JSON</button>
      <button @click="exportAs('csv')" class="format-button">CSV</button>
    </div>
  </div>
</template>

<script setup>
import { useDataManagement } from "../../composables/useDataManagement";

const { appData } = useDataManagement();

const exportAs = (format) => {
  switch (format) {
    case "json":
      const dataStr = JSON.stringify(appData.value, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      const link = document.createElement("a");
      link.href = dataUri;
      link.download = `data-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      break;
    case "csv":
      // 简化CSV导出实现
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Type,ID,Title\n";

      appData.value.cards.forEach((card) => {
        csvContent += `Card,${card.id},"${card.data.title}"\n`;
      });

      appData.value.templates.forEach((template) => {
        csvContent += `Template,${template.id},"${template.name}"\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const csvLink = document.createElement("a");
      csvLink.setAttribute("href", encodedUri);
      csvLink.setAttribute(
        "download",
        `cards_export_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(csvLink);
      csvLink.click();
      document.body.removeChild(csvLink);
      break;
  }
};
</script>
