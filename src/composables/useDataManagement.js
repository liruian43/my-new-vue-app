import { useLocalStorage } from "./useLocalStorage";

export function useDataManagement() {
  const { data: appData, save: saveData } = useLocalStorage(
    "appData",
    {
      cards: [],
      templates: [],
      settings: {},
    },
    true
  );

  // 导出数据为JSON
  const exportData = () => {
    const dataStr = JSON.stringify(appData.value, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    return {
      jsonStr: dataStr, // 修改字段名更语义化
      uri: dataUri,
      fileName: `data-export-${new Date().toISOString().slice(0, 10)}.json`,
    };
  };

  // 导入数据
  const importData = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          if (validateData(importedData)) {
            appData.value = importedData;
            saveData();
            resolve(true);
          } else {
            reject(new Error("Invalid data format"));
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsText(file);
    });
  };

  // 数据验证
  const validateData = (data) => {
    return (
      data &&
      Array.isArray(data.cards) &&
      Array.isArray(data.templates) &&
      typeof data.settings === "object"
    );
  };

  return {
    appData,
    exportData,
    importData,
    validateData,
  };
}
