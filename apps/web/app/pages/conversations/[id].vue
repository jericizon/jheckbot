<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <ConversationSidebar
      :conversations="sidebarConversations"
      :active-conversations="activeConversations"
      :current-project-id="conversation?.project_id"
      :active-id="id"
      @new="navigateTo('/projects/' + conversation?.project_id)"
      @delete="deleteConversation"
      @rename="handleSidebarRename"
    />

    <!-- Main chat area -->
    <div class="flex-1 flex flex-col h-full min-w-0">
      <!-- Header -->
      <ProjectHeader
        :project="project"
        :branch="projectBranch"
        @project-updated="onProjectUpdated"
        @project-deleted="onProjectDeleted"
        @branch-switched="handleBranchSwitched"
      >
        <template #subtitle>
          <div class="flex items-center gap-1.5 min-w-0">
            <input
              v-if="editingTitle"
              v-model="titleDraft"
              @blur="saveTitle"
              @keydown.enter.exact.prevent="saveTitle"
              @keydown.escape="cancelEditTitle"
              ref="titleInputEl"
              aria-label="Conversation title"
              class="flex-1 min-w-0 text-xs bg-transparent border-b border-content-subtle focus:outline-none focus:border-content text-content py-0.5"
            />
            <button
              v-else
              @click="startEditTitle"
              class="flex items-center gap-1 min-w-0 group"
              :disabled="agentRunning"
            >
              <span class="text-xs text-content-subtle truncate">{{
                conversation?.title || 'Conversation'
              }}</span>
              <svg
                class="w-3 h-3 text-content-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <span
              v-if="agentRunning"
              class="flex items-center gap-1 text-xs text-emerald-500 font-medium shrink-0 tabular-nums"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active · {{ elapsedLabel }}
            </span>
          </div>
        </template>
      </ProjectHeader>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto">
        <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <!-- Empty state -->
          <div
            v-if="messages.length === 0 && !liveOutput && !agentStarting"
            class="flex flex-col items-center justify-center min-h-[50vh] text-center animate-fade-in"
          >
            <div
              class="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center mb-4"
            >
              <svg
                class="w-6 h-6 text-content-subtle"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z"
                />
              </svg>
            </div>
            <p class="text-content-muted text-sm">Send a message to start working with Devin.</p>
          </div>

          <!-- Message list -->
          <template v-for="msg in messages" :key="msg.id">
            <!-- User message -->
            <div v-if="msg.role === 'user'" class="group flex justify-end animate-slide-up">
              <div class="flex flex-col items-end gap-1 max-w-[80%]">
                <div
                  class="rounded-2xl rounded-br-md bg-accent-muted px-4 py-2.5 text-sm text-content whitespace-pre-wrap break-words"
                >
                  {{ msg.content }}
                </div>
                <!-- Copy prompt to clipboard -->
                <button
                  @click="copyMessage(msg.content, `user-${msg.id}`)"
                  class="invisible group-hover:visible flex items-center gap-1 text-[11px] text-content-subtle hover:text-content transition-colors px-1"
                  :title="copiedId === `user-${msg.id}` ? 'Copied!' : 'Copy message'"
                >
                  <svg
                    v-if="copiedId === `user-${msg.id}`"
                    class="w-3 h-3 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg
                    v-else
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{{ copiedId === `user-${msg.id}` ? 'Copied' : 'Copy' }}</span>
                </button>
              </div>
            </div>

            <!-- Assistant message -->
            <div
              v-else-if="msg.role === 'assistant'"
              class="group flex gap-3 animate-slide-up"
            >
              <div
                class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0 mt-0.5"
              >
                <svg
                  class="w-3.5 h-3.5 text-surface"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div class="flex-1 min-w-0 pt-1">
                <div v-if="msg.model" class="flex items-center gap-1 mb-1">
                  <span
                    class="text-[10px] font-medium uppercase tracking-wide text-content-subtle bg-surface-subtle rounded px-1.5 py-0.5"
                    >{{ msg.model }}</span
                  >
                </div>
                <div class="text-sm text-content leading-relaxed min-w-0">
                  <Markdown :content="msg.content" />
                </div>
                <!-- Copy response to clipboard -->
                <button
                  @click="copyMessage(msg.content, `assistant-${msg.id}`)"
                  class="invisible group-hover:visible flex items-center gap-1 mt-1.5 text-[11px] text-content-subtle hover:text-content transition-colors"
                  :title="copiedId === `assistant-${msg.id}` ? 'Copied!' : 'Copy response'"
                >
                  <svg
                    v-if="copiedId === `assistant-${msg.id}`"
                    class="w-3 h-3 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg
                    v-else
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{{ copiedId === `assistant-${msg.id}` ? 'Copied' : 'Copy' }}</span>
                </button>
              </div>
            </div>

            <!-- System message -->
            <div v-else class="flex gap-3 animate-slide-up">
              <div
                class="w-7 h-7 rounded-full bg-surface-subtle flex items-center justify-center shrink-0 mt-0.5"
              >
                <svg
                  class="w-4 h-4 text-content-subtle"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div class="flex-1 text-sm text-content-muted whitespace-pre-wrap break-words pt-1">
                {{ msg.content }}
              </div>
            </div>
          </template>

          <!-- Live output -->
          <div v-if="liveOutput" class="flex gap-3 animate-fade-in">
            <div
              class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0 mt-0.5"
            >
              <svg
                class="w-3.5 h-3.5 text-surface"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div class="flex-1 min-w-0 pt-1">
              <div class="flex items-center gap-1 mb-1">
                <span
                  class="text-[10px] font-medium uppercase tracking-wide text-content-subtle bg-surface-subtle rounded px-1.5 py-0.5"
                  >{{ selectedModel }}</span
                >
              </div>
              <div class="text-sm text-content leading-relaxed min-w-0">
                <Markdown :content="liveOutput" />
              </div>
              <!-- Background processing indicator -->
              <div
                v-if="agentRunning"
                class="flex items-center gap-1.5 mt-2 text-xs text-content-subtle animate-fade-in"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Processing · {{ elapsedLabel }}</span>
              </div>
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="agentStarting" class="flex gap-3 animate-fade-in">
            <div
              class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0 mt-0.5"
            >
              <svg
                class="w-3.5 h-3.5 text-surface"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div class="flex items-center gap-1 pt-2.5">
              <span
                class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce"
                style="animation-delay: 0ms"
              />
              <span
                class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce"
                style="animation-delay: 150ms"
              />
              <span
                class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce"
                style="animation-delay: 300ms"
              />
            </div>
          </div>

          <!-- Error -->
          <div v-if="sendError" class="flex justify-center animate-fade-in">
            <div
              class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-500 flex items-center gap-2"
            >
              {{ sendError }}
              <button @click="sendError = ''" class="text-red-400 hover:text-red-500">
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Changed files panel -->
      <ChangedFilesPanel ref="changedFilesPanel" :project-id="conversation?.project_id" />

      <!-- Input area -->
      <div class="shrink-0 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div class="max-w-3xl mx-auto px-4">
          <!-- Input box -->
          <div
            class="relative rounded-2xl border border-border bg-white focus-within:border-content-subtle/60 focus-within:ring-1 focus-within:ring-content-subtle/30 transition-all"
          >
            <textarea
              v-model="input"
              @keydown.enter.exact.prevent="sendMessage"
              @keydown.enter.shift.exact="input += '\n'"
              @input="autoResize"
              :placeholder="
                voice.listening.value
                  ? 'Listening... speak now'
                  : agentStarting || agentRunning
                    ? 'Queue a message...'
                    : 'Message Devin...'
              "
              rows="1"
              ref="inputEl"
              class="w-full rounded-2xl px-4 py-3 pr-28 text-sm text-content placeholder-content-subtle dark:text-gray-900 dark:placeholder-gray-400 bg-transparent focus:outline-none resize-none max-h-32 overflow-y-auto min-h-[52px]"
            />
            <!-- Interim transcript shown as a subtle hint while listening -->
            <span
              v-if="voice.listening.value && voice.interim.value"
              class="absolute left-4 bottom-2.5 text-sm text-content-subtle dark:text-gray-500 italic pointer-events-none max-w-[60%] truncate"
              >{{ voice.interim.value }}</span
            >
            <div class="absolute right-2 bottom-2 flex items-center gap-1 shrink-0">
              <button
                @click="toggleVoice"
                :title="
                  !voice.supported.value
                    ? 'Voice input not available in this browser'
                    : voice.listening.value
                      ? 'Stop voice input'
                      : 'Voice input'
                "
                :aria-pressed="voice.listening.value"
                class="rounded-lg w-8 h-8 flex items-center justify-center transition-all active:scale-95"
                :class="
                  voice.listening.value
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : voice.supported.value
                      ? 'text-content-subtle hover:text-content hover:bg-surface-subtle dark:text-gray-500 dark:hover:text-gray-900 dark:hover:bg-gray-100'
                      : 'text-content-subtle/40 dark:text-gray-400 cursor-not-allowed'
                "
              >
                <svg
                  v-if="!voice.listening.value"
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-4 h-4 animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9A2.25 2.25 0 0118.75 7.5v9a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 16.5v-9z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 9.563C9 8.386 10.343 7.5 12 7.5s3 .886 3 2.063v4.875c0 1.177-1.343 2.062-3 2.062s-3-.885-3-2.062V9.563z"
                  />
                </svg>
              </button>
              <button
                v-if="agentRunning"
                @click="stopModalOpen = true"
                class="rounded-lg w-8 h-8 flex items-center justify-center transition-all active:scale-95 bg-red-500/15 text-red-500 hover:bg-red-500/25 shrink-0"
                title="Stop agent"
                aria-label="Stop agent"
              >
                <span class="w-3 h-3 rounded-[3px] bg-current" />
              </button>
              <button
                @click="sendMessage"
                :disabled="!input.trim()"
                class="rounded-lg w-8 h-8 flex items-center justify-center transition-all shrink-0 active:scale-95"
                :class="
                  input.trim()
                    ? 'bg-content text-surface hover:opacity-80 dark:bg-gray-900 dark:text-white'
                    : 'bg-surface-subtle text-content-subtle dark:bg-gray-100 dark:text-gray-400'
                "
                :title="
                  (agentStarting || agentRunning) && input.trim() ? 'Queue message' : 'Send message'
                "
              >
                <svg
                  v-if="agentStarting || agentRunning"
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Queued messages -->
          <div v-if="queue.length > 0" class="mt-2 space-y-1.5">
            <div
              class="text-[10px] font-medium uppercase tracking-wide text-content-subtle px-1 flex items-center gap-1.5"
            >
              <svg
                class="w-3 h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Queued ({{ queue.length }})</span>
            </div>
            <div
              v-for="(item, idx) in queue"
              :key="item.id"
              class="rounded-lg border border-border bg-surface-subtle/50 px-3 py-2 animate-slide-up"
            >
              <div class="flex items-start gap-2">
                <span class="text-[10px] font-mono text-content-subtle shrink-0 mt-0.5">{{
                  idx + 1
                }}</span>
                <div class="flex-1 min-w-0">
                  <template v-if="editingQueueId === item.id">
                    <textarea
                      v-model="item.content"
                      rows="1"
                      class="w-full text-sm text-content bg-transparent focus:outline-none resize-none"
                      style="min-height: 20px"
                    />
                  </template>
                  <p
                    v-else
                    class="text-sm text-content-muted whitespace-pre-wrap break-words line-clamp-3"
                  >
                    {{ item.content }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    v-if="editingQueueId === item.id"
                    @click="saveEditQueueItem(item.id)"
                    class="text-content-subtle hover:text-emerald-500 transition-colors p-0.5"
                    title="Save"
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    v-else
                    @click="startEditQueueItem(item.id)"
                    class="text-content-subtle hover:text-content transition-colors p-0.5"
                    title="Edit"
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    @click="removeQueueItem(item.id)"
                    class="text-content-subtle hover:text-red-500 transition-colors p-0.5"
                    title="Remove"
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Voice listening indicator with live soundwave -->
          <div
            v-if="voice.listening.value"
            class="flex items-center justify-center gap-2 mt-2 animate-fade-in"
          >
            <VoiceWaveform :active="voice.listening.value" />
            <span class="text-xs text-emerald-500 whitespace-nowrap"
              >Listening — tap mic when done</span
            >
          </div>

          <!-- Voice error (dismissible) -->
          <div
            v-if="voice.error.value"
            class="flex items-start gap-2 mt-2 px-1 text-xs text-red-500 animate-fade-in"
          >
            <svg
              class="w-3.5 h-3.5 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="flex-1">{{ voice.error.value }}</span>
            <button @click="voice.clearError()" class="shrink-0 text-red-400 hover:text-red-500">
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Model selector + bypass toggle + hint -->
          <MessageToolbar
            v-model="selectedModel"
            :families="availableFamilies"
            v-model:bypass-mode="bypassMode"
            @open-skills="skillsPickerOpen = true"
            @open-models="modelPickerOpen = true"
          />
        </div>
      </div>
    </div>

    <!-- Delete conversation modal -->
    <ConfirmModal
      :open="deleteModalOpen"
      title="Delete Conversation"
      :message="
        deleteTarget
          ? `Delete \u201C${deleteTargetTitle}\u201D? This cannot be undone.`
          : 'Delete this conversation? This cannot be undone.'
      "
      confirm-label="Yes, delete"
      loading-label="Deleting..."
      :loading="deletingConv"
      :error="deleteConvError"
      @confirm="confirmDeleteConversation"
      @cancel="closeDeleteModal"
    />

    <!-- Stop agent modal -->
    <ConfirmModal
      :open="stopModalOpen"
      title="Stop Agent"
      message="Stop the running agent? Any in-progress work will be interrupted. Queued messages will still be sent after the agent stops."
      confirm-label="Yes, stop"
      loading-label="Stopping..."
      :loading="stoppingAgent"
      @confirm="confirmStopAgent"
      @cancel="stopModalOpen = false"
    />

    <!-- Skills picker -->
    <SkillsPicker
      :open="skillsPickerOpen"
      @select="insertSkill"
      @close="skillsPickerOpen = false"
    />

    <!-- Model picker -->
    <ModelPicker
      :open="modelPickerOpen"
      :families="availableFamilies"
      :current="selectedModel"
      @select="selectedModel = $event"
      @close="modelPickerOpen = false"
    />

  </div>
</template>

<script setup lang="ts">
import type { ModelFamily } from '~/components/MessageToolbar.vue'

const route = useRoute()
const convApi = useConversations()
const projectApi = useProjects()
const sse = useSSE()
const { activeConversations } = useActiveConversations()

const id = computed(() => route.params.id as string)

interface Conversation {
  id: string
  project_id: string
  title: string
  agent_status: string
}
interface Project {
  id: string
  name: string
  path: string
  description: string | null
  enabled: boolean
}
interface Message {
  id: string
  role: string
  content: string
  message_type: string
  model?: string | null
}
interface QueuedMessage {
  id: string
  content: string
}

const conversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const liveOutput = ref('')
const input = ref('')
const agentRunning = ref(false)
const agentStarting = ref(false)
// Real-time elapsed counter for the active agent run. Started when a prompt
// is sent (or when reconnecting to an already-running agent) and stopped on
// the terminal SSE status event.
const agentTimer = useAgentTimer()
const elapsedLabel = computed(() => {
  const s = agentTimer.elapsedSeconds.value
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
})
const sendError = ref('')
const skillsPickerOpen = ref(false)
const modelPickerOpen = ref(false)
const queue = ref<QueuedMessage[]>([])
const editingQueueId = ref<string | null>(null)
const { bypassMode } = useBypassMode()
const voice = useVoiceInput(input)
const { getDraft, setDraft, clearDraft } = useConversationDrafts()
const { getQueue, setQueue, clearQueue } = useConversationQueues()
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInputEl = ref<HTMLInputElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const changedFilesPanel = ref<{ refresh: () => void } | null>(null)
const project = ref<Project | null>(null)
const projectBranch = ref<string | null>(null)
const sidebarConversations = ref<Conversation[]>([])
let eventSource: EventSource | null = null

// Track background conversations that were running on the previous poll,
// so we can detect transitions to idle and fire a notification.
const prevBackgroundRunning = ref<Set<string>>(new Set())

// Refresh sidebar statuses periodically so background runs in other
// conversations surface without a manual reload. While the active
// conversation's agent is running, SSE owns its status and we skip
// clobbering it from the (possibly stale) poll result.
useConversationPolling(
  () => conversation.value?.project_id,
  (convs) => {
    if (agentRunning.value) {
      const activeId = id.value
      sidebarConversations.value = convs.map((c) =>
        c.id === activeId
          ? {
              ...c,
              agent_status:
                sidebarConversations.value.find((s) => s.id === activeId)?.agent_status ??
                c.agent_status,
            }
          : c,
      )
    } else {
      sidebarConversations.value = convs
    }

    // Detect background conversations that just finished. The active
    // conversation is owned by SSE above; only notify for others.
    const { notify } = useNotifications()
    const nextRunning = new Set<string>()
    for (const c of convs) {
      const isActive = c.id === id.value
      const wasRunning =
        prevBackgroundRunning.value.has(c.id) ||
        (!isActive && (c.agent_status === 'running' || c.agent_status === 'starting'))
      const isRunning = c.agent_status === 'running' || c.agent_status === 'starting'
      if (isRunning && !isActive) nextRunning.add(c.id)
      if (wasRunning && !isRunning && !isActive) {
        notify(`${c.title || 'Conversation'} — task completed`, {
          body: `Devin finished working on "${c.title || 'Conversation'}"`,
          tag: `conv-${c.id}`,
          url: `/conversations/${c.id}`,
        })
      }
    }
    prevBackgroundRunning.value = nextRunning
  },
)

const availableFamilies = ref<ModelFamily[]>([])
const { selectedModel, ensureDefault } = useSelectedModel()

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
}

function toggleVoice() {
  voice.toggle()
  if (voice.listening.value) {
    nextTick(() => inputEl.value?.focus())
  }
}

// Copy a message's raw content to the system clipboard. `key` uniquely
// identifies which message was copied so the checkmark feedback can target
// the right bubble. Falls back to a hidden textarea for non-secure contexts
// (e.g. HTTP) where navigator.clipboard is unavailable.
const copiedId = ref<string | null>(null)
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

async function copyMessage(content: string, key: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(content)
    } else {
      const ta = document.createElement('textarea')
      ta.value = content
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    copiedId.value = key
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch {
    // Clipboard write rejected (permissions, etc.) — silently no-op
  }
}

// Insert a selected skill slash command into the input and focus it so the
// user can immediately append their prompt.
function insertSkill(command: string) {
  input.value = input.value ? `${input.value} ${command}`.trim() : command
  nextTick(() => {
    inputEl.value?.focus()
    autoResize()
  })
}

async function loadSidebarConversations() {
  if (!conversation.value?.project_id) return
  try {
    sidebarConversations.value = await convApi.listByProject(conversation.value.project_id)
  } catch {
    // ignore
  }
}

// Keep the active conversation's sidebar entry in sync with SSE status
// events so the background-process indicator updates live.
function setSidebarStatus(convId: string, status: string) {
  const idx = sidebarConversations.value.findIndex((c) => c.id === convId)
  if (idx >= 0) sidebarConversations.value[idx].agent_status = status
}

async function load() {
  try {
    const [conv, msgs, modelsRes] = await Promise.all([
      convApi.get(id.value),
      convApi.messages(id.value),
      convApi.models(),
    ])
    conversation.value = conv
    messages.value = msgs
    availableFamilies.value = modelsRes.families
    ensureDefault(modelsRes.default)

    // Restore any unsent draft and queued messages for this conversation.
    input.value = getDraft(id.value)
    queue.value = getQueue(id.value)

    loadSidebarConversations()
    loadProjectInfo(conv.project_id)

    let agentBusy = false
    try {
      const agentStatus = await convApi.agentStatus(id.value)
      if (agentStatus && (agentStatus.status === 'running' || agentStatus.status === 'starting')) {
        agentBusy = true
        agentRunning.value = true
        // Resume the elapsed counter from the backend's start timestamp so
        // reconnects (page refresh, background tab) show true wall-clock time.
        const startedAtMs = agentStatus.startedAt ? Date.parse(agentStatus.startedAt) : NaN
        agentTimer.start(Number.isNaN(startedAtMs) ? undefined : startedAtMs)
        connectSSE()
      }
    } catch {
      // 404 means no agent run
    }

    // If the agent is idle and there are queued messages left over from a
    // previous session, drain them now so they are not stuck.
    if (!agentBusy && queue.value.length > 0) {
      drainQueue()
    }

    await nextTick()
    scrollToBottom()
  } catch {
    // ignore
  }
}

async function loadProjectInfo(projectId: string) {
  try {
    project.value = await projectApi.get(projectId)
  } catch {
    // ignore — header just won't show project details
  }
  try {
    const result = await projectApi.branch(projectId)
    projectBranch.value = result.branch
  } catch {
    projectBranch.value = null
  }
}

function handleBranchSwitched(branch: string) {
  projectBranch.value = branch
  // Working tree contents changed; refresh the changed-files panel.
  changedFilesPanel.value?.refresh()
}

function onProjectUpdated(updated: Project) {
  project.value = updated
}

async function onProjectDeleted() {
  const projectId = project.value?.id
  if (projectId) {
    await navigateTo('/projects')
  }
}

function connectSSE() {
  eventSource = sse.connect(id.value, async (event) => {
    if (event.type === 'status') {
      const data = JSON.parse(event.data)
      if (data.status === 'running') {
        agentRunning.value = true
      }
      if (
        data.status === 'completed' ||
        data.status === 'stopped' ||
        data.status === 'failed' ||
        data.status === 'idle'
      ) {
        agentRunning.value = false
        agentStarting.value = false
        agentTimer.stop()
        setSidebarStatus(id.value, 'idle')
        eventSource?.close()
        await reloadMessages()
        changedFilesPanel.value?.refresh()
        // Fire a push notification when the page is backgrounded
        if (data.status !== 'idle') {
          const { notify } = useNotifications()
          const title = conversation.value?.title || 'Conversation'
          const verb =
            data.status === 'completed'
              ? 'completed'
              : data.status === 'failed'
                ? 'failed'
                : 'stopped'
          notify(`${title} — task ${verb}`, {
            body:
              data.status === 'failed' && data.error
                ? data.error
                : `Devin finished working on "${title}"`,
            tag: `conv-${id.value}`,
            url: `/conversations/${id.value}`,
          })
        }
        // Drain the next queued message, if any.
        drainQueue()
      } else {
        setSidebarStatus(id.value, data.status)
      }
    } else if (event.type === 'output') {
      agentStarting.value = false
      const data = JSON.parse(event.data)
      liveOutput.value = data.content
      await nextTick()
      scrollToBottom()
    } else if (event.type === 'media') {
      // The media file is also injected into the output buffer as markdown,
      // so it renders inline in the live output. This event signals a new
      // image/video arrived — scroll to reveal it immediately.
      await nextTick()
      scrollToBottom()
    }
  })
}

async function refreshConversation() {
  try {
    const conv = await convApi.get(id.value)
    conversation.value = conv
    const idx = sidebarConversations.value.findIndex((c) => c.id === id.value)
    if (idx >= 0) sidebarConversations.value[idx].title = conv.title
  } catch {
    // keep existing title on failure
  }
}

async function reloadMessages() {
  try {
    const msgs = await convApi.messages(id.value)
    messages.value = msgs
    liveOutput.value = ''
    await nextTick()
    scrollToBottom()
  } catch {
    // Keep existing messages if reload fails
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function startEditTitle() {
  if (agentRunning.value) return
  titleDraft.value = conversation.value?.title || ''
  editingTitle.value = true
  nextTick(() => titleInputEl.value?.focus())
}

function cancelEditTitle() {
  editingTitle.value = false
  titleDraft.value = ''
}

async function saveTitle() {
  if (!editingTitle.value) return
  const newTitle = titleDraft.value.trim()
  editingTitle.value = false
  if (!newTitle || !conversation.value || newTitle === conversation.value.title) {
    titleDraft.value = ''
    return
  }
  try {
    const updated = await convApi.update(id.value, { title: newTitle })
    conversation.value = { ...conversation.value, title: updated.title }
    // Update sidebar entry too
    const idx = sidebarConversations.value.findIndex((c) => c.id === id.value)
    if (idx >= 0) sidebarConversations.value[idx].title = updated.title
  } catch {
    // Keep old title on failure
  }
  titleDraft.value = ''
}

async function handleSidebarRename(convId: string, newTitle: string) {
  try {
    const updated = await convApi.update(convId, { title: newTitle })
    const conv = sidebarConversations.value.find((c) => c.id === convId)
    if (conv) conv.title = updated.title
    if (conversation.value?.id === convId) {
      conversation.value = { ...conversation.value, title: updated.title }
    }
  } catch {
    // Keep old title on failure
  }
}

const deleteModalOpen = ref(false)
const deleteTarget = ref<string | null>(null)
const deletingConv = ref(false)
const deleteConvError = ref('')
const stopModalOpen = ref(false)
const stoppingAgent = ref(false)

const deleteTargetTitle = computed(
  () =>
    sidebarConversations.value.find((c) => c.id === deleteTarget.value)?.title ??
    conversation.value?.title ??
    'this conversation',
)

function deleteConversation(convId: string) {
  deleteTarget.value = convId
  deleteConvError.value = ''
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  if (deletingConv.value) return
  deleteModalOpen.value = false
  deleteTarget.value = null
  deleteConvError.value = ''
}

async function confirmDeleteConversation() {
  const convId = deleteTarget.value
  if (!convId) return
  deletingConv.value = true
  deleteConvError.value = ''
  try {
    await convApi.delete(convId)
    clearDraft(convId)
    clearQueue(convId)
    sidebarConversations.value = sidebarConversations.value.filter((c) => c.id !== convId)
    deleteModalOpen.value = false
    deleteTarget.value = null
    if (convId === id.value) {
      // Send the user back to the project page (which hosts the "New Conversation" action)
      // rather than the root index. Fall back to /projects if project_id is missing.
      const projectId = conversation.value?.project_id
      await navigateTo(projectId ? `/projects/${projectId}` : '/projects')
    }
  } catch (err: unknown) {
    deleteConvError.value =
      (err as { data?: { error?: string } })?.data?.error || 'Failed to delete conversation'
  } finally {
    deletingConv.value = false
  }
}

function sendMessage() {
  const prompt = input.value.trim()
  if (!prompt) return

  input.value = ''
  autoResize()

  // While the agent is busy, queue the message instead of blocking input.
  if (agentStarting.value || agentRunning.value) {
    queue.value.push({ id: `q-${Date.now()}-${queue.value.length}`, content: prompt })
    return
  }

  sendNow(prompt)
}

async function sendNow(prompt: string) {
  voice.stop()
  sendError.value = ''

  const tempId = `temp-${Date.now()}`
  messages.value.push({
    id: tempId,
    role: 'user',
    content: prompt,
    message_type: 'prompt',
  })
  await nextTick()
  scrollToBottom()

  // Show the typing indicator immediately so the user sees their prompt is
  // being processed while the backend prepares the agent run. Without this,
  // there's no visual feedback during the sendMessage API call.
  agentStarting.value = true

  try {
    const result = await convApi.sendMessage(
      id.value,
      prompt,
      selectedModel.value,
      bypassMode.value,
    )

    const idx = messages.value.findIndex((m) => m.id === tempId)
    if (idx >= 0) {
      messages.value[idx] = result.message
    }

    // Backend auto-generates a title from the first prompt; refresh the
    // header + sidebar so the new title shows without a full page reload.
    if (conversation.value?.title === 'New Conversation') {
      refreshConversation()
    }

    agentRunning.value = true
    liveOutput.value = ''
    agentTimer.start()
    setSidebarStatus(id.value, 'starting')
    connectSSE()
  } catch (err: unknown) {
    const idx = messages.value.findIndex((m) => m.id === tempId)
    if (idx >= 0) messages.value.splice(idx, 1)

    const message =
      err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { error?: string } }).data?.error
        : err instanceof Error
          ? err.message
          : 'Failed to send message'
    sendError.value = message ?? 'Failed to send message'

    agentRunning.value = false
    agentStarting.value = false
    agentTimer.stop()
    setSidebarStatus(id.value, 'idle')

    // If the send failed but there are queued messages, drain the next one
    // so the user isn't stuck with a dead queue.
    drainQueue()
  }
}

// Process the next queued message after an agent run completes.
function drainQueue() {
  if (queue.value.length === 0) return
  const next = queue.value.shift()!
  editingQueueId.value = null
  sendNow(next.content)
}

function removeQueueItem(itemId: string) {
  queue.value = queue.value.filter((q) => q.id !== itemId)
  if (editingQueueId.value === itemId) editingQueueId.value = null
}

function startEditQueueItem(itemId: string) {
  editingQueueId.value = itemId
}

function saveEditQueueItem(itemId: string) {
  editingQueueId.value = null
}

async function confirmStopAgent() {
  stoppingAgent.value = true
  try {
    await convApi.stopAgent(id.value)
    stopModalOpen.value = false
    // Don't close the SSE here — let the 'stopped' status event arrive and
    // trigger the completion handler (which reloads messages and drains the
    // queue). Closing early would race with the backend's stopped event.
  } catch {
    agentRunning.value = false
    agentStarting.value = false
    agentTimer.stop()
    setSidebarStatus(id.value, 'idle')
    eventSource?.close()
    stopModalOpen.value = false
  } finally {
    stoppingAgent.value = false
  }
}

watch([messages, liveOutput], async () => {
  await nextTick()
  scrollToBottom()
})

// Keep textarea height in sync when voice input mutates `input` without a
// DOM input event.
watch(input, () => autoResize())

// Persist an unsent message so it survives page refreshes.
watch(input, (val) => setDraft(id.value, val))

// Persist queued messages so they survive switching conversations or projects.
watch(queue, (val) => setQueue(id.value, val), { deep: true })

onMounted(load)
onUnmounted(() => {
  agentTimer.stop()
  voice.stop()
  eventSource?.close()
})
</script>
