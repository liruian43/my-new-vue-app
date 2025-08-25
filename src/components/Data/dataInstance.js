// src/components/Data/dataInstance.js
import { reactive } from 'vue'
import { ID } from './services/id.js'

function createDefaultState() {
  return {
    questionBank: { questions: [], categories: [] },
    envSnapshots: [],
    currentMode: ID.ROOT_ADMIN_MODE_ID,
    cards: [],
    options: {},
    syncHistory: [],
    fieldAuthorizations: {}
  }
}

export const dataInstance = {
  state: createDefaultState(),

  init: function () {
    // 用 reactive，避免响应性断链
    this.state = reactive(createDefaultState())

    // 绑定子模块方法，使内部 this 指向 dataInstance 顶层
    const bind = (obj, methods) => methods.forEach(m => {
      if (typeof obj[m] === 'function') obj[m] = obj[m].bind(this)
    })
    bind(this.card, ['add', 'update', 'delete'])
    bind(this.option, ['add', 'update', 'delete'])
    bind(this.questionBank, ['addQuestion', 'removeQuestion', 'addCategory'])
    bind(this.envSnapshot, ['create', 'apply'])

    return this
  },

  update: function (key, value) {
    if (this.state.hasOwnProperty(key)) this.state[key] = value
  },

  utils: {
    generateCardId: function (usedIds) {
      return ID.generateNextCardId(usedIds)
    },
    generateOptionId: function (existingIds) {
      const list = existingIds.map(id => ({ id }))
      return ID.generateNextOptionId(list)
    },
    compareCardIds: ID.compareCardIds,
    isValidCardId: ID.isValidCardId,
    isValidOptionId: ID.isValidOptionId,
    isValidFullOptionId: ID.isOptionExcelId,
    parseFullOptionId: function (fullId) {
      const result = ID.parseFullOptionId(fullId)
      return result.valid ? { cardId: result.cardId, optionId: result.optionId } : null
    }
  },

  // 修旧如旧：补齐 UniversalCard/旧界面依赖的字段结构
  card: {
    add: function (cardData) {
      const usedIds = this.state.cards.map(c => c.id)
      const newId = this.utils.generateCardId(usedIds)

      const base = {
        data: {
          title: null,
          options: [],
          selectOptions: [],
          selectedValue: null
        },
        showDropdown: false,
        isTitleEditing: false,
        isOptionsEditing: false,
        isSelectEditing: false,
        isPresetEditing: false,
        editableFields: {
          optionName: true,
          optionValue: true,
          optionUnit: true,
          optionCheckbox: true,
          optionActions: true,
          select: true
        }
      }
      const merged = { ...base, ...(cardData || {}) }
      merged.data = { ...base.data, ...(cardData?.data || {}) }

      const newCard = { id: newId, ...merged }
      this.state.cards.push(newCard)
      return newCard
    },

    update: function (cardId, updatedData) {
      const i = this.state.cards.findIndex(c => c.id === cardId)
      if (i !== -1) {
        this.state.cards[i] = { ...this.state.cards[i], ...updatedData }
        return this.state.cards[i]
      }
      return null
    },

    delete: function (cardId) {
      const i = this.state.cards.findIndex(c => c.id === cardId)
      if (i !== -1) this.state.cards.splice(i, 1)
      Object.keys(this.state.options).forEach(k => {
        if (k.startsWith(cardId)) delete this.state.options[k]
      })
    }
  },

  option: {
    add: function (cardId, optionData) {
      const card = this.state.cards.find(c => c.id === cardId)
      if (!card) return null

      const existingOptions = Object.keys(this.state.options)
        .filter(k => k.startsWith(cardId))
        .map(k => k.replace(cardId, ''))

      const optionId = this.utils.generateOptionId(existingOptions)
      const fullId = `${cardId}${optionId}`
      const newOption = { id: optionId, ...optionData }
      this.state.options[fullId] = newOption

      if (!Array.isArray(card.data?.options)) {
        if (!card.data) card.data = {};
        card.data.options = []
      }
      card.data.options.push({
        id: optionId,
        name: newOption.name ?? null,
        value: newOption.value ?? null,
        unit: newOption.unit ?? null,
        checked: !!newOption.checked
      })

      return { fullId, ...newOption }
    },

    update: function (fullId, updatedData) {
      if (this.state.options[fullId]) {
        this.state.options[fullId] = { ...this.state.options[fullId], ...updatedData }
        return this.state.options[fullId]
      }
      return null
    },

    delete: function (cardId, fullId) {
      if (this.state.options[fullId]) delete this.state.options[fullId]
      const card = this.state.cards.find(c => c.id === cardId)
      if (card && Array.isArray(card.data?.options)) {
        const optId = fullId.replace(cardId, '')
        const i = card.data.options.findIndex(o => String(o.id) === String(optId))
        if (i !== -1) card.data.options.splice(i, 1)
      }
    }
  },

  questionBank: {
    addQuestion: function (questionData) {
      const newQuestion = { id: `q_${Date.now()}`, ...questionData, createdAt: new Date().toISOString() }
      this.state.questionBank.questions.push(newQuestion)
      return newQuestion
    },
    removeQuestion: function (questionId) {
      const arr = this.state.questionBank.questions
      const i = arr.findIndex(q => q.id === questionId)
      if (i !== -1) arr.splice(i, 1)
    },
    addCategory: function (categoryName) {
      const cats = this.state.questionBank.categories
      if (!cats.includes(categoryName)) cats.push(categoryName)
    }
  },

  envSnapshot: {
    create: function (versionLabel) {
      const snapshot = { version: versionLabel, timestamp: Date.now(), data: { ...this.state } }
      this.state.envSnapshots.push(snapshot)
      return snapshot
    },
    apply: function (versionLabel) {
      const snapshot = this.state.envSnapshots.find(s => s.version === versionLabel)
      if (snapshot) { Object.assign(this.state, snapshot.data); return true }
      return false
    }
  }
}