// src/components/Data/boot.js
export function ensureMinimumSession(store) {
  if (!Array.isArray(store.sessionCards)) store.sessionCards = []

  if (store.sessionCards.length === 0) {
    const firstId =
      (typeof store.generateNextCardId === 'function' && store.generateNextCardId()) || 'A'

    store.sessionCards.push({
      id: firstId,
      modeId: store.currentModeId || 'root_admin',
      data: {
        title: null,
        options: [{ id: 1, name: null, value: null, unit: null, checked: false }],
        selectOptions: [],
        selectedValue: null
      },
      editableFields: {
        optionName: true,
        optionValue: true,
        optionUnit: true,
        optionCheckbox: true,
        optionActions: true,
        select: true
      },
      showDropdown: false,
      isTitleEditing: false,
      isOptionsEditing: false,
      isSelectEditing: false,
      isPresetEditing: false
    })
    store.selectedCardId = firstId
    return
  }

  const first = store.sessionCards[0]
  if (!first.data) first.data = {}
  if (!Array.isArray(first.data.options) || first.data.options.length === 0) {
    first.data.options = [{ id: 1, name: null, value: null, unit: null, checked: false }]
  }
  if (!store.selectedCardId) store.selectedCardId = first.id
}