<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-surface-elevated border-b border-border px-4 py-3 z-40">
      <h1 class="text-lg font-semibold">Settings</h1>
    </header>

    <div class="px-4 py-4 max-w-2xl mx-auto space-y-4">
      <div v-if="user" class="rounded-lg border border-border bg-surface-elevated p-4">
        <div class="text-sm text-content-subtle">Signed in as</div>
        <div class="font-medium mt-1">{{ user.username }}</div>
      </div>

      <!-- Theme toggle -->
      <div class="rounded-lg border border-border bg-surface-elevated p-4 flex items-center justify-between">
        <div>
          <div class="text-sm font-medium">Appearance</div>
          <div class="text-xs text-content-subtle mt-0.5">Switch between light and dark mode</div>
        </div>
        <button
          @click="toggleTheme"
          class="rounded-lg border border-border px-3 py-2 text-sm text-content-muted hover:text-content hover:border-content-subtle transition-colors"
        >
          {{ theme === 'dark' ? 'Light' : 'Dark' }}
        </button>
      </div>

      <!-- Notifications -->
      <div class="rounded-lg border border-border bg-surface-elevated p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium">Push Notifications</div>
            <div class="text-xs text-content-subtle mt-0.5">Get alerted with sound when a task finishes — even if the app is closed</div>
          </div>
        </div>

        <!-- Not supported -->
        <div v-if="!notifSupported" class="text-xs text-content-subtle rounded-lg border border-border px-3 py-2">
          Notifications are not supported on this device/browser.
        </div>

        <!-- Permission blocked -->
        <div v-else-if="notifPermission === 'denied'" class="text-xs text-amber-500 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          Notification permission is blocked. Enable it in your browser/site settings to receive alerts.
        </div>

        <!-- Push not configured on server -->
        <div v-else-if="!pushEnabled" class="text-xs text-content-subtle rounded-lg border border-border px-3 py-2">
          Push notifications are not configured on the server. Ask the admin to set VAPID keys.
        </div>

        <!-- Not yet subscribed -->
        <div v-else-if="!pushSubscribed" class="flex items-center justify-between">
          <div class="text-xs text-content-subtle">Enable push notifications on this device</div>
          <button
            @click="enablePush"
            :disabled="notifBusy"
            class="rounded-lg border border-border px-3 py-2 text-sm text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50"
          >
            {{ notifBusy ? '...' : 'Enable' }}
          </button>
        </div>

        <!-- Subscribed -->
        <div v-else class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs text-emerald-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <span>Push notifications enabled</span>
          </div>
          <div class="flex gap-2">
            <button
              @click="sendTestPush"
              :disabled="notifBusy"
              class="rounded-lg border border-border px-3 py-2 text-sm text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50"
            >
              {{ notifBusy ? '...' : 'Test' }}
            </button>
            <button
              @click="disablePush"
              :disabled="notifBusy"
              class="rounded-lg border border-border px-3 py-2 text-sm text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-50"
            >
              Disable
            </button>
          </div>
        </div>
      </div>

      <button
        @click="handleLogout"
        class="w-full rounded-lg border border-red-500/30 bg-surface-elevated py-3 text-sm font-medium text-red-500 hover:bg-red-500/5 transition-colors"
      >
        Sign Out
      </button>

      <div class="rounded-lg border border-border bg-surface-elevated p-4 space-y-2">
        <div class="text-sm font-semibold">About</div>
        <div class="text-xs text-content-subtle">JheckBot - Self-hosted mobile development assistant</div>
        <div class="text-xs text-content-subtle">Controls Devin CLI from your phone</div>
      </div>

      <div class="rounded-lg border border-red-500/30 bg-surface-elevated p-4 space-y-3">
        <div class="text-sm font-semibold text-red-500">Danger Zone</div>
        <div class="text-xs text-content-subtle">
          Clear all projects, conversations, and history. Active agents will be stopped. This cannot be undone.
        </div>
        <button
          v-if="!confirmingClear"
          @click="confirmingClear = true"
          class="w-full rounded-lg border border-red-500/30 py-3 text-sm font-medium text-red-500 hover:bg-red-500/5 transition-colors"
        >
          Clear All Data
        </button>
        <div v-else class="space-y-3">
          <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
            Are you sure? This will permanently delete every project, conversation, and message.
          </div>
          <div class="flex gap-2">
            <button
              @click="confirmingClear = false"
              :disabled="clearing"
              class="flex-1 rounded-lg border border-border py-3 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              @click="handleClearAll"
              :disabled="clearing"
              class="flex-1 rounded-lg bg-red-500 text-white py-3 text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {{ clearing ? 'Clearing...' : 'Yes, delete everything' }}
            </button>
          </div>
          <p v-if="clearError" class="text-sm text-red-500">{{ clearError }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, logout, fetchUser } = useAuth()
const projectsApi = useProjects()
const { theme, toggle: toggleTheme } = useTheme()
const {
  permission: notifPermission,
  isSupported: notifSupported,
  pushSupported,
  pushSubscribed,
  pushEnabled,
  requestPermission: notifRequest,
  notify: notifNotify,
  subscribePush,
  unsubscribePush,
  checkPushSubscription,
  testPush,
} = useNotifications()

const confirmingClear = ref(false)
const clearing = ref(false)
const clearError = ref('')
const notifBusy = ref(false)

async function enablePush() {
  if (notifPermission.value === 'denied') return
  notifBusy.value = true
  try {
    await subscribePush()
  } finally {
    notifBusy.value = false
  }
}

async function disablePush() {
  notifBusy.value = true
  try {
    await unsubscribePush()
  } finally {
    notifBusy.value = false
  }
}

async function sendTestPush() {
  notifBusy.value = true
  try {
    // Also fire a local notification for immediate visual feedback
    notifNotify('JheckBot — test notification', {
      body: 'If you see this, local notifications work. A push test was also sent.',
      tag: 'test',
      force: true,
    })
    await testPush()
  } finally {
    notifBusy.value = false
  }
}

async function handleLogout() {
  await logout()
}

async function handleClearAll() {
  clearing.value = true
  clearError.value = ''
  try {
    await projectsApi.clearAllData()
    confirmingClear.value = false
    await navigateTo('/projects')
  } catch (err: unknown) {
    clearError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to clear data'
  } finally {
    clearing.value = false
  }
}

onMounted(async () => {
  await fetchUser()
  if (!user.value) {
    await navigateTo('/login')
  }
  await checkPushSubscription()
})
</script>
