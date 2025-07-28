import { ref, computed } from "vue";
import { useLocalStorage } from "./useLocalStorage";

export function useAuth() {
  const { data: authData, save: saveAuth } = useLocalStorage("authData", {
    currentUser: null,
    users: [],
  }); // 移除加密参数

  const login = (username, pin) => {
    // 简化验证逻辑
    const user = authData.value.users.find(
      (u) => u.username === username && u.pin === pin
    );
    if (user) {
      authData.value.currentUser = user;
      saveAuth();
      return true;
    }
    return false;
  };

  // 保持其他方法不变
  return {
    currentUser: computed(() => authData.value.currentUser),
    login,
    logout: () => {
      authData.value.currentUser = null;
      saveAuth();
    },
    register: (username, pin) => {
      if (authData.value.users.some((u) => u.username === username)) {
        return false;
      }

      const newUser = {
        id: Date.now(),
        username,
        pin,
        createdAt: new Date().toISOString(),
      };

      authData.value.users.push(newUser);
      authData.value.currentUser = newUser;
      saveAuth();
      return true;
    },
  };
}
