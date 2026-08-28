// Shared settings-modal open state across pages. Not persisted — the modal
// is always closed on fresh page loads.
const settingsOpen = ref(false)

export function useSettingsModal() {
  function open() {
    settingsOpen.value = true
  }

  function close() {
    settingsOpen.value = false
  }

  return {
    settingsOpen: readonly(settingsOpen),
    open,
    close,
  }
}
