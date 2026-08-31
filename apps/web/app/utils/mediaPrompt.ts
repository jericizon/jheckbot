import { nextTick, type Ref } from 'vue'

export function getMediaPrompt(projectId?: string): string {
  const context = projectId ? 'this project' : 'the relevant project'
  return `Generate an image or video for ${context} and save it to an appropriate directory. Provide the direct URL or file path so the chat can preview it inline.`
}

export function insertMediaPrompt(
  input: Ref<string>,
  inputEl: Ref<HTMLTextAreaElement | null>,
  autoResize: () => void,
  projectId?: string,
): void {
  const prompt = getMediaPrompt(projectId)
  input.value = input.value ? `${input.value} ${prompt}`.trim() : prompt
  nextTick(() => {
    inputEl.value?.focus()
    autoResize()
  })
}
