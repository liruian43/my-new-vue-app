<template>
  <div class="login-form">
    <h3>用户登录</h3>

    <div v-if="currentUser">
      <p>已登录为: {{ currentUser.username }}</p>
      <button @click="logout" class="auth-button">注销</button>
    </div>

    <form v-else @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="username">用户名:</label>
        <input type="text" id="username" v-model="username" required />
      </div>

      <div class="form-group">
        <label for="pin">PIN码:</label>
        <input
          type="password"
          id="pin"
          v-model="pin"
          required
          maxlength="4"
          pattern="\d{4}"
        />
      </div>

      <button type="submit" class="auth-button">登录</button>
      <button
        type="button"
        @click="showRegister = true"
        class="auth-button secondary"
      >
        注册新用户
      </button>
    </form>

    <RegisterForm
      v-if="showRegister"
      @registered="handleRegistered"
      @cancel="showRegister = false"
    />

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAuth } from "../../composables/useAuth";
import RegisterForm from "./RegisterForm.vue";

const { currentUser, login, logout } = useAuth();

const username = ref("");
const pin = ref("");
const errorMessage = ref("");
const showRegister = ref(false);

const handleLogin = () => {
  if (login(username.value, pin.value)) {
    username.value = "";
    pin.value = "";
    errorMessage.value = "";
  } else {
    errorMessage.value = "用户名或PIN码不正确";
  }
};

const handleRegistered = () => {
  showRegister.value = false;
};
</script>

<style scoped>
.login-form {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  max-width: 300px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.auth-button {
  padding: 0.5rem 1rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
  margin-top: 0.5rem;
}

.auth-button.secondary {
  background-color: #2196f3;
}

.error-message {
  color: #f44336;
  margin-top: 1rem;
}
</style>
