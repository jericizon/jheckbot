# Plan: Native Android Notifications for JheckBot Wrapper

## Overview

Add a JavaScript bridge and native `NotificationManager` wiring to the existing JheckBot Android wrapper so the web app's browser `Notification` API calls are surfaced as native Android status-bar notifications. No FCM or third-party service is used.

## Architecture Decisions

- Use `WebView.addJavascriptInterface` and a JS shim instead of modifying the web app business logic. The web app continues to call `new Notification(...)` and `Notification.requestPermission()`.
- Use `androidx.core` notification support for backward compatibility back to `minSdk 24`.
- Request `POST_NOTIFICATIONS` at runtime on Android 13+ during `MainActivity.onCreate`.
- Store constants in a dedicated `NotificationConstants.kt` file to keep `MainActivity` and `NotificationBridge` in sync.
- Use a vector notification icon (`ic_notification.xml`) so it works across densities and respects light/dark notification surfaces.

## Task List

### Task 1: Add notification constants and bridge
- Create `NotificationConstants.kt` with channel id, bridge name, and permission request code.
- Create `NotificationBridge.kt` with `showNotification`, `permission`, and `requestPermission` methods.
- Create `ic_notification.xml` as a white, transparent vector bell icon.

**Acceptance:** Kotlin files compile when checked with `./gradlew :app:compileDebugKotlin` (if tooling is available), and `ic_notification.xml` is a valid vector.

**Verify:** `aapt` or build does not reject the icon; the bridge class has no unresolved references.

**Files touched:**
- `apps/android/app/src/main/java/com/jheckbot/wrapper/NotificationConstants.kt`
- `apps/android/app/src/main/java/com/jheckbot/wrapper/NotificationBridge.kt`
- `apps/android/app/src/main/res/drawable/ic_notification.xml`

### Task 2: Update `MainActivity.kt`
- Add `POST_NOTIFICATIONS` permission request at runtime (API 33+).
- Create a `NotificationChannel` on API 26+.
- Add the `NotificationBridge` to the WebView.
- Inject the JS `Notification` shim in `WebViewClient.onPageFinished`.
- Handle `notificationUrl` from a tapped notification in `onCreate` and `onNewIntent`.
- Keep all existing URL fallback, persistence, and configuration logic.

**Acceptance:** `MainActivity.kt` compiles and the web build still passes.

**Verify:** `pnpm --filter @jheckbot/web build`; attempt `./gradlew :app:compileDebugKotlin`.

**Files touched:** `apps/android/app/src/main/java/com/jheckbot/wrapper/MainActivity.kt`

### Task 3: Update manifest and resources
- Add `android.permission.POST_NOTIFICATIONS` to `AndroidManifest.xml`.
- Add `notification_channel_name` and `notification_channel_description` to `strings.xml`.

**Acceptance:** Manifest is valid and strings are translatable.

**Verify:** `aapt dump badging` or gradle manifest merge succeeds.

**Files touched:**
- `apps/android/app/src/main/AndroidManifest.xml`
- `apps/android/app/src/main/res/values/strings.xml`

### Task 4: Optional web type declaration
- Add `AndroidBridge` interface to `useNotifications.ts` for TypeScript only (no runtime change).

**Acceptance:** `pnpm --filter @jheckbot/web typecheck` passes.

**Verify:** `pnpm --filter @jheckbot/web typecheck`.

**Files touched:** `apps/web/app/composables/useNotifications.ts`

### Task 5: Update documentation
- Update `apps/android/README.md` to describe the native notification feature and its limitations.

**Acceptance:** README explains that notifications are free, require no subscription, and only work while the app is alive.

**Verify:** Readme diff is coherent.

**Files touched:** `apps/android/README.md`

### Task 6: Validate build
- Run `pnpm --filter @jheckbot/web build`.
- Run `./gradlew :app:compileDebugKotlin` if Android SDK/Gradle is present; otherwise document the limitation.
- Inspect that no hardcoded IP appears in new code; the wrapper still uses `assets/config.json` and `SharedPreferences`.

**Acceptance:** Web build passes; Android build is attempted and errors (if any) are documented.

**Verify:** Build output and exit codes.

**Files touched:** None (verification only).

### Task 7: Write QA report
- Record build verification, runtime limitations, and manual QA steps.

**Acceptance:** QA report is in `docs/superpowers/qa/20260830_android_native_notifications.md`.

**Verify:** Review the document.

**Files touched:** `docs/superpowers/qa/20260830_android_native_notifications.md`

## Checkpoint: After Tasks 1–4

- [ ] `NotificationBridge`, `NotificationConstants`, and `ic_notification.xml` created.
- [ ] `MainActivity.kt` creates the channel, requests permission, and wires the bridge.
- [ ] Manifest and strings updated.
- [ ] Optional TypeScript declaration in `useNotifications.ts` is clean.

## Checkpoint: Complete

- [ ] `pnpm --filter @jheckbot/web build` passes.
- [ ] Android compilation is attempted or environment limitation documented.
- [ ] README and QA report updated.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Android SDK not installed in this environment | High | Document the limitation; verify Kotlin by other means where possible; leave the project buildable for the user. |
| WebView does not expose `Notification` or blocks overrides | Medium | Test with `sendTestPush`; if blocked, adjust the JS shim to intercept `useNotifications` instead. |
| JS shim injected too late for early `Notification.permission` reads | Low | Override in `onPageFinished` before the web app scripts run; Nuxt client hooks run after `DOMContentLoaded`. |
| Runtime permission request interrupts the initial URL check | Low | Request permission after the app has created the notification channel but keep the WebView loading flow intact. |
