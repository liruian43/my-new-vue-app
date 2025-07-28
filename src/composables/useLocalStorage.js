import { ref, watch } from "vue";

export function useLocalStorage(key, initialValue) {
  const storedValue = ref(initialValue);

  const loadFromStorage = () => {
    try {
      const rawValue = localStorage.getItem(key);
      if (rawValue) {
        const parsedValue = JSON.parse(rawValue);
        if (parsedValue.version === "1.0") {
          storedValue.value = parsedValue.data;
        }
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
  };

  const saveToStorage = (value) => {
    try {
      const dataToStore = {
        version: "1.0",
        data: value,
      };
      localStorage.setItem(key, JSON.stringify(dataToStore));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  };

  loadFromStorage();

  watch(
    storedValue,
    (newValue) => {
      saveToStorage(newValue);
    },
    { deep: true }
  );

  return {
    data: storedValue,
    load: loadFromStorage,
    save: saveToStorage,
  };
}
