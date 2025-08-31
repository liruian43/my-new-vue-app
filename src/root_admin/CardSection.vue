<template>
  <div class="card-section">
    <!-- 1) 环境全量版本：一排，单独容器 -->
    <div class="bar env-bar">
      <input
        v-model="envVersionInput"
        class="input"
        type="text"
        placeholder="输入全量环境版本号，如 v1.0.0"
      />
      <button 
        class="test-button" 
        :disabled="!envVersionInput || savingEnv" 
        @click="saveEnvVersion"
      >
        {{ savingEnv ? "保存中…" : "保存全量版本" }}
      </button>

      <button 
        class="test-button" 
        :disabled="savingEnv" 
        @click="refreshEnvSnapshots"
      >
        刷新版本列表
      </button>

      <!-- 全量区下拉：加载后“默认开启所有编辑功能”（可手动关闭） -->
      <select v-model="envSelectedVersion" class="select">
        <option value="">选择全量版本（未选择）</option>
        <option 
          v-for="snap in envSnapshots" 
          :key="snap.version" 
          :value="snap.version"
        >
          {{ snap.version }}（{{ formatTs(snap.timestamp) }}｜hash {{ snap.hash }}）
        </option>
      </select>
    </div>

    <!-- 2) 添加题库：一排，单独容器 -->
    <div class="bar qb-bar">
      <label class="label">题库版本：</label>
      <!-- 题库下拉：加载后“仅开启复选框”，其他编辑关闭 -->
      <select v-model="qbSelectedVersion" class="select">
        <option value="">选择题库版本（未选择）</option>
        <option 
          v-for="snap in envSnapshots" 
          :key="snap.version" 
          :value="snap.version"
        >
          {{ snap.version }}
        </option>
      </select>

      <label class="label">表达式预览：</label>
      <span class="expr">
        {{ expressionPrefix ? expressionPrefix + '→' : '请勾选选项生成 A1+B2…→' }}
      </span>

      <label class="label">结果内容：</label>
      <input
        v-model="resultContent"
        class="input"
        type="text"
        placeholder="在此输入表达式的结果内容"
      />

      <button
        class="test-button"
        :disabled="!qbSelectedVersion || !expressionPrefix || !resultContent || savingQuestion"
        @click="addQuestion"
      >
        {{ savingQuestion ? '添加中…' : '添加到题库' }}
      </button>

      <!-- 固定换行：“将保存为： xxx” -->
      <div class="hint-row">
        <span class="hint-title">将保存为：</span>
        <span class="hint-text">{{ (expressionPrefix || '…') + '→' + (resultContent || '') }}</span>
      </div>

      <span v-if="storeError" class="error-text">{{ storeError }}</span>
    </div>

    <!-- 3) 卡片操作：一排，单独容器 -->
    <div class="bar ops-bar">
      <button class="test-button" @click="addCard">添加卡片</button>

      <button 
        class="test-button" 
        @click="prepareDeleteCard" 
        :disabled="!selectedCardId"
      >
        删除卡片
      </button>

      <button
        class="test-button"
        @click="toggleTitleEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isTitleEditing }"
      >
        {{ selectedCard?.isTitleEditing ? "完成编辑" : "编辑标题" }}
      </button>

      <button
        class="test-button"
        @click="togglePresetEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.isPresetEditing ? "完成预设" : "编辑预设" }}
      </button>

      <button
        class="test-button"
        @click="toggleSelectEditing"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.isSelectEditing && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.isSelectEditing ? "完成下拉编辑" : "编辑下拉菜单" }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionName')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionName && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionName ? "完成名称编辑" : "编辑选项名称" }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionValue')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionValue && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionValue ? "完成值编辑" : "编辑选项值" }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionUnit')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionUnit && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionUnit ? "完成单位编辑" : "编辑选项单位" }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionCheckbox')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionCheckbox && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionCheckbox ? "隐藏选项复选框" : "显示选项复选框" }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionActions')"
        :disabled="!selectedCardId || selectedCard?.isPresetEditing"
        :class="{ active: selectedCard?.editableFields.optionActions && !selectedCard?.isPresetEditing }"
      >
        {{ selectedCard?.editableFields.optionActions ? "隐藏选项按钮" : "显示选项按钮" }}
      </button>
    </div>

    <!-- 预设编辑提示 -->
    <div v-if="selectedCard?.isPresetEditing" class="preset-editing-hint">
      <p>预设编辑模式：选择或添加一个下拉选项，勾选需要关联的选项，自动保存关联；点击“完成预设”将保存并退出。</p>
    </div>

    <!-- 卡片列表 -->
    <div class="cards-container">
      <div
        v-for="card in cards"
        :key="card.id"
        class="card-wrapper"
        :class="{
          deleting: deletingCardId === card.id,
          selected: selectedCardId === card.id,
          'hide-option-actions': !card.editableFields.optionActions || card.isPresetEditing
        }"
        @click.stop="selectCard(card.id)"
      >
        <UniversalCard
          v-model:modelValue="card.data.title"
          v-model:options="card.data.options"
          v-model:selectedValue="card.data.selectedValue"
          :selectOptions="card.data.selectOptions"
          :showDropdown="card.showDropdown || card.isPresetEditing"
          :isTitleEditing="card.isTitleEditing"
          :isOptionsEditing="card.isPresetEditing || card.isOptionsEditing"
          :isSelectEditing="card.isPresetEditing || card.isSelectEditing"
          :on-add-option="(afterId) => handleAddOption(card.id, afterId)"
          :on-delete-option="(optionId) => handleDeleteOption(card.id, optionId)"
          :on-add-select-option="(label) => handleAddSelectOption(card.id, label)"
          :on-delete-select-option="(optionId) => handleDeleteSelectOption(card.id, optionId)"
          :on-dropdown-toggle="(value) => setShowDropdown(card.id, value)"
          :editableFields="{
            ...card.editableFields,
            optionActions: true,
            optionCheckbox: card.editableFields.optionCheckbox || card.isPresetEditing
          }"
          :editDefaults="computeEditDefaults(card)"
          :editState="computeEditState(card)"
          :class="{ selected: selectedCardId === card.id }"
          :style="{}"
        />

        <div v-if="deletingCardId === card.id" class="delete-overlay">
          <button 
            class="delete-card-button" 
            @click.stop="confirmDeleteCard(card.id)"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useCardStore } from '../components/Data/store'
import UniversalCard from '../components/UniversalCard/UniversalCard.vue'

const cardStore = useCardStore()

// 卡片数据
const cards = computed(() => {
  return [
    ...(Array.isArray(cardStore.tempCards) ? cardStore.tempCards : []),
    ...(Array.isArray(cardStore.sessionCards) ? cardStore.sessionCards : [])
  ]
})

// 选中/删除中的卡片
const selectedCardId = computed({
  get: () => cardStore.selectedCardId,
  set: (value) => { cardStore.selectedCardId = value }
})
const deletingCardId = computed({
  get: () => cardStore.deletingCardId,
  set: (value) => { cardStore.deletingCardId = value }
})
const selectedCard = computed(() => cardStore.selectedCard)

// 1) 环境全量版本保存
const envVersionInput = ref('')
const envSnapshots = ref([]) // [{version, timestamp, hash}]
const savingEnv = ref(false)

// 2) 添加题库
const qbSelectedVersion = ref('') // 题库选择的版本（加载后仅开复选框）
const qbSelectedSnapshotHash = ref('')
const resultContent = ref('')
const savingQuestion = ref(false)

// 3) 全量区下拉（新）：加载后开启所有编辑功能
const envSelectedVersion = ref('')
const envSelectedSnapshotHash = ref('')

// 错误展示（来自 store.error）
const storeError = computed(() => cardStore.error || '')

// 状态：应用快照中（避免应用快照导致的重渲染误判为“已偏离版本”）
const applyingSnapshot = ref(false)

// 监听卡片，初始化字段结构
watch(
  () => [...cards.value],
  (newCards) => {
    if (!Array.isArray(newCards)) return
    newCards.forEach((card) => {
      if (!card.data) card.data = {}
      if (!Array.isArray(card.data.options)) card.data.options = []
      if (!Array.isArray(card.data.selectOptions)) card.data.selectOptions = []
      if (!('showDropdown' in card)) card.showDropdown = false
      if (!('isPresetEditing' in card)) card.isPresetEditing = false
      if (!card.editableFields) {
        card.editableFields = {
          optionName: true,
          optionValue: true,
          optionUnit: true,
          optionCheckbox: true,
          optionActions: true,
          select: true
        }
      }
    })
  },
  { deep: true, immediate: true }
)

// 预设编辑中：勾选变化 => 自动保存到当前选中的下拉项
watch(
  () => selectedCard.value?.data.options,
  (newOptions) => {
    if (selectedCard.value?.isPresetEditing && newOptions && selectedCard.value.data.selectedValue) {
      const cardId = selectedCard.value.id
      const selectedOption = selectedCard.value.data.selectOptions
        .find(opt => opt.label === selectedCard.value.data.selectedValue)
      if (selectedOption) {
        const checkedOptions = newOptions.filter(option => option.checked)
        cardStore.savePresetForSelectOption(cardId, selectedOption.id, checkedOptions)
      }
    }
  },
  { deep: true }
)

// 非预设编辑时：切换下拉项 => 应用已保存的预设
watch(
  () => selectedCard.value?.data.selectedValue,
  (newValue, oldValue) => {
    if (newValue && newValue !== oldValue && !selectedCard.value?.isPresetEditing) {
      const cardId = selectedCard.value.id
      const selectedOption = selectedCard.value.data.selectOptions
        .find(opt => opt.label === newValue)
      if (selectedOption) {
        cardStore.applyPresetToCard(cardId, selectedOption.id)
      }
    }
  }
)

// 从所有卡片的“已勾选选项”生成表达式前缀：A1+B2+...
const checkedFullIds = computed(() => {
  const out = []
  for (const card of cards.value) {
    const cardExcel = /^[A-Z]+$/.test(String(card?.id)) ? String(card.id) : null
    if (!cardExcel) continue
    const opts = Array.isArray(card?.data?.options) ? card.data.options : []
    opts.forEach((opt, idx) => {
      if (opt?.checked) out.push(`${cardExcel}${idx + 1}`)
    })
  }
  return out
})

const expressionPrefix = computed(() => {
  if (!checkedFullIds.value.length) return ''
  return checkedFullIds.value.join('+')
})

// 保存全量版本
const saveEnvVersion = async () => {
  if (!envVersionInput.value) return
  savingEnv.value = true
  try {
    const ok = await cardStore.saveEnvFullSnapshot(envVersionInput.value)
    if (ok) {
      envVersionInput.value = ''
      await refreshEnvSnapshots()
    }
  } finally {
    savingEnv.value = false
  }
}

// 刷新版本列表
const refreshEnvSnapshots = async () => {
  const list = await cardStore.listEnvFullSnapshots()
  envSnapshots.value = Array.isArray(list) ? list : []
  
  if (qbSelectedVersion.value) {
    const ok = envSnapshots.value.some(s => s.version === qbSelectedVersion.value)
    if (!ok) {
      qbSelectedVersion.value = ''
      qbSelectedSnapshotHash.value = ''
    }
  }
  
  if (envSelectedVersion.value) {
    const ok2 = envSnapshots.value.some(s => s.version === envSelectedVersion.value)
    if (!ok2) {
      envSelectedVersion.value = ''
      envSelectedSnapshotHash.value = ''
    }
  }
}

// 题库下拉 -> 应用快照，并“只开复选框”
watch(
  () => qbSelectedVersion.value,
  async (v, oldV) => {
    if (v === oldV) return
    if (!v) {
      qbSelectedSnapshotHash.value = ''
      return
    }
    
    const snap = envSnapshots.value.find(s => s.version === v)
    applyingSnapshot.value = true
    
    try {
      await cardStore.applyEnvFullSnapshot(v)
      // 默认仅开复选框
      if (typeof cardStore.enableOnlyCheckbox === 'function') {
        cardStore.enableOnlyCheckbox()
      } else {
        enableOnlyCheckboxLocal()
      }
      qbSelectedSnapshotHash.value = snap?.hash || ''
    } finally {
      setTimeout(() => {
        applyingSnapshot.value = false
      }, 0)
    }
  }
)

// 全量区下拉 -> 应用快照，并“开启所有编辑功能”
watch(
  () => envSelectedVersion.value,
  async (v, oldV) => {
    if (v === oldV) return
    if (!v) {
      envSelectedSnapshotHash.value = ''
      return
    }
    
    const snap = envSnapshots.value.find(s => s.version === v)
    applyingSnapshot.value = true
    
    try {
      await cardStore.applyEnvFullSnapshot(v)
      // 默认开启所有编辑功能（可手动关闭）
      enableAllEditingLocal()
      envSelectedSnapshotHash.value = snap?.hash || ''
    } finally {
      setTimeout(() => {
        applyingSnapshot.value = false
      }, 0)
    }
  }
)

// 深度监听卡片内容变更：若与已选版本 hash 不一致，自动清空对应选择
watch(
  () => cardStore.sessionCards,
  async () => {
    if (applyingSnapshot.value) return
    const currentHash = computeCurrentEnvHash()
    
    if (qbSelectedVersion.value && qbSelectedSnapshotHash.value && currentHash !== qbSelectedSnapshotHash.value) {
      qbSelectedVersion.value = ''
      qbSelectedSnapshotHash.value = ''
    }
    
    if (envSelectedVersion.value && envSelectedSnapshotHash.value && currentHash !== envSelectedSnapshotHash.value) {
      envSelectedVersion.value = ''
      envSelectedSnapshotHash.value = ''
    }
  },
  { deep: true }
)

// 添加到题库（需要选择题库版本）
const addQuestion = async () => {
  if (!qbSelectedVersion.value || !expressionPrefix.value || !resultContent.value) return
  savingQuestion.value = true
  
  try {
    await cardStore.addQuestionToBank({
      version: qbSelectedVersion.value,
      expression: expressionPrefix.value + '→',
      content: resultContent.value
    })
    resultContent.value = ''
  } finally {
    savingQuestion.value = false
  }
}

// 常用操作
const addCard = () => {
  cardStore.addCard({
    data: {
      title: `新卡片 ${cards.value.length + 1}`,
      options: [{ id: 1, name: null, value: null, unit: null, checked: false }],
      selectOptions: [{ id: 1, label: null }],
      selectedValue: null
    },
    showDropdown: false
  })
}

const selectCard = (id) => {
  selectedCardId.value = id
  deletingCardId.value = null
}

const prepareDeleteCard = () => {
  if (selectedCardId.value) deletingCardId.value = selectedCardId.value
}

const confirmDeleteCard = (id) => {
  cardStore.deleteCard(id)
}

const toggleTitleEditing = () => {
  if (selectedCardId.value) cardStore.toggleTitleEditing(selectedCardId.value)
}

const togglePresetEditing = () => {
  if (selectedCardId.value) cardStore.togglePresetEditing(selectedCardId.value)
}

const toggleSelectEditing = () => {
  if (selectedCardId.value) cardStore.toggleSelectEditing(selectedCardId.value)
}

const toggleEditableField = (field) => {
  if (selectedCardId.value) cardStore.toggleEditableField(selectedCardId.value, field)
}

const handleAddOption = (cardId, afterId) => {
  cardStore.addOption(cardId, afterId)
  const cardIndex = cards.value.findIndex(c => c.id === cardId)
  
  if (cardIndex !== -1) {
    const card = cards.value[cardIndex]
    const newOption = card.data.options[card.data.options.length - 1]
    if (newOption) {
      newOption.name = newOption.name || null
      newOption.value = newOption.value || null
      newOption.unit = newOption.unit || null
    }
  }
}

const handleDeleteOption = (cardId, optionId) => {
  cardStore.deleteOption(cardId, optionId)
}

const handleAddSelectOption = (cardId, label) => {
  cardStore.addSelectOption(cardId, label || null)
}

const handleDeleteSelectOption = (cardId, optionId) => {
  cardStore.deleteSelectOption(cardId, optionId)
}

const setShowDropdown = (cardId, value) => {
  cardStore.setShowDropdown(cardId, value)
}

// 适配新版 UniversalCard：将旧 editableFields 的三项开关映射到 editDefaults
function computeEditDefaults(card) {
  const ef = (card && card.editableFields) ? card.editableFields : {}
  const inPreset = !!card?.isPresetEditing
  return {
    name: !!ef.optionName && !inPreset,
    value: !!ef.optionValue && !inPreset,
    unit: !!ef.optionUnit && !inPreset
  }
}

// 目前未提供“单个选项独立触发”的 UI 控件，保持空对象；将来若 store 支持细化，可在此按需下发
function computeEditState(card) {
  return {}
}

// 本地：仅开复选框，其它编辑关闭（若 store 未注入对应方法时兜底）
function enableOnlyCheckboxLocal() {
  (cardStore.sessionCards || []).forEach(card => {
    card.isOptionsEditing = false
    card.isSelectEditing = false
    card.isPresetEditing = false
    card.editableFields = {
      ...card.editableFields,
      optionName: false,
      optionValue: false,
      optionUnit: false,
      optionActions: false,
      select: false,
      optionCheckbox: true
    }
  })
}

// 本地：开启所有编辑功能（可手动关闭）
function enableAllEditingLocal() {
  (cardStore.sessionCards || []).forEach(card => {
    card.isOptionsEditing = true
    card.isSelectEditing = true
    card.isPresetEditing = false
    card.editableFields = {
      ...card.editableFields,
      optionName: true,
      optionValue: true,
      optionUnit: true,
      optionActions: true,
      select: true,
      optionCheckbox: true
    }
  })
}

// 计算当前环境哈希（与保存快照一致的算法）
function computeCurrentEnvHash() {
  const env = { cards: {}, options: {} }
  const sc = Array.isArray(cardStore.sessionCards) ? cardStore.sessionCards : []
  
  for (const card of sc) {
    const cardId = String(card.id)
    if (!/^[A-Z]+$/.test(cardId)) continue
    
    env.cards[cardId] = {
      id: cardId,
      title: card?.data?.title ?? null,
      dropdown: (Array.isArray(card?.data?.selectOptions) ? card.data.selectOptions : [])
        .map(opt => (opt?.label ?? null))
    }
    
    const opts = Array.isArray(card?.data?.options) ? card.data.options : []
    opts.forEach((opt, idx) => {
      const optionId = String(idx + 1)
      const combinedId = `${cardId}${optionId}`
      env.options[combinedId] = {
        name: opt?.name ?? null,
        value: opt?.value ?? null,
        unit: opt?.unit ?? null
      }
    })
  }
  
  const full = {}
  Object.keys(env.options).forEach(fullId => {
    const m = fullId.match(/^([A-Z]+)(\d+)$/)
    if (!m) return
    
    const cardId = m[1]
    const optionId = m[2]
    const c = env.cards[cardId] || {}
    const o = env.options[fullId] || {}
    
    full[fullId] = {
      combinedId: fullId,
      cardId,
      optionId,
      configTitle: c.title ?? null,
      optionName: o.name ?? null,
      optionValue: o.value ?? null,
      optionUnit: o.unit ?? null,
      dropdownFlag: false
    }
  })
  
  const json = stableStringify(full)
  return hashString(json)
}

// 稳定序列化 + 简单哈希
function stableStringify(obj) {
  const seen = new WeakSet()
  const recur = (v) => {
    if (v === null || typeof v !== 'object') return v
    if (seen.has(v)) return null
    seen.add(v)
    if (Array.isArray(v)) return v.map(recur)
    
    const keys = Object.keys(v).sort()
    const out = {}
    for (const k of keys) {
      const val = v[k]
      if (val === undefined) continue
      out[k] = recur(val)
    }
    return out
  }
  return JSON.stringify(recur(obj))
}

function hashString(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i)
    h = h | 0
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8)
}

// 时间格式化
const formatTs = (ts) => {
  try {
    const d = new Date(ts)
    return `${d.getMonth()+1}-${d.getDate()} ${
      String(d.getHours()).padStart(2,'0')
    }:${
      String(d.getMinutes()).padStart(2,'0')
    }`
  } catch {
    return ''
  }
}

// 初始化
onMounted(async () => {
  await cardStore.loadQuestionBank()
  await refreshEnvSnapshots()
})
</script>

<style scoped>
.card-section {
  margin-bottom: 20px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

/* 三条“长条按钮容器”统一样式 */
.bar {
  margin-bottom: 12px;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.env-bar {}
.qb-bar {}
.ops-bar {}

.input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 220px;
}

.select {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 220px;
}

.label {
  color: #333;
  min-width: 84px;
  text-align: right;
}

.expr {
  font-family: monospace;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
}

.error-text {
  color: #f44336;
}

/* 题库提示：强制换到新行 */
.hint-row {
  flex-basis: 100%;          /* 在 .bar（flex-wrap）中独占一整行 */
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.hint-title {
  white-space: nowrap;
  color: #666;
}
.hint-text {
  color: #666;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}

/* 按钮沿用原样式 */
.test-button {
  margin: 5px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #4caf50;
  color: white;
  cursor: pointer;
}

.test-button.active {
  background-color: #2196f3;
}

.test-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 预设编辑提示 */
.preset-editing-hint {
  margin: 10px 0;
  padding: 10px;
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
  color: #0d47a1;
  border-radius: 4px;
  font-size: 14px;
}

/* 卡片列表 */
.cards-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.card-wrapper {
  position: relative;
  width: 240px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.card-wrapper.selected {
  box-shadow: 0 0 0 3px #4caf50;
}

.card-wrapper.deleting .universal-card {
  box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
  opacity: 0.9;
}

/* 仅隐藏“加/减按钮”，不影响名称/值/单位输入框 */
:deep(.hide-option-actions .option-actions) {
  display: none !important;
}

/* 删除覆盖层 */
.delete-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 0, 0, 0.1);
  border-radius: inherit;
  display: flex;
  justify-content: flex-end;
  padding: 10px;
}

.delete-card-button {
  width: 30px;
  height: 30px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>