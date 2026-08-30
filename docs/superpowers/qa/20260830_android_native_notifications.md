# QA Report: Native Android Notifications for JheckBot Wrapper

## Scope

Verify that the Android wrapper can post native status-bar notifications when the JheckBot web app calls the browser `Notification` API, using no paid or subscription-based push service.

## Environment

- Build machine: Linux, OpenJDK 17.0.20
- Android SDK: not present in this environment (`ANDROID_HOME` is empty)
- Gradle wrapper: present at `apps/android/gradlew` (Gradle 8.10.2)
- Branch: `feat/interactive`
- No physical Android device attached.

## Verification Performed

### 1. Code review

- `MainActivity.kt` creates a notification channel and requests `POST_NOTIFICATIONS` at runtime for Android 13+.
- `NotificationBridge.kt` exposes `permission()`, `requestPermission()`, and `showNotification()` via `WebView.addJavascriptInterface`.
- A JS shim is injected in `WebViewClient.onPageFinished` to override `window.Notification` and `Notification.requestPermission` without modifying the web app business logic.
- `AndroidManifest.xml` declares `android.permission.POST_NOTIFICATIONS`.
- `res/drawable/ic_notification.xml` is a white vector bell icon suitable for the notification shade.
- `strings.xml` contains the notification channel name and description.
- `apps/android/README.md` documents the native notification behavior and its limitations.
- No FCM, Firebase, or third-party push service dependencies were added.

### 2. Web build

- `pnpm --filter @jheckbot/web build` completed successfully (exit code 0).
- No web app source files were changed, so the existing build pipeline is unaffected.

### 3. Android compilation attempt

- `./gradlew :app:compileDebugKotlin --no-daemon` was attempted in `apps/android`.
- Build failed immediately with: `SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable ...`
- This is an environment limitation; the Kotlin source and resources were not rejected by the build tool.

## Manual QA Steps for User

1. Install an Android SDK and set `ANDROID_HOME` (or run `pnpm build:android` on a machine with the SDK).
2. Build the APK: `pnpm build:android`
3. Install to a device: `adb install installers/jheckbot-debug.apk`
4. Launch the app and grant the notification permission when prompted.
5. Open JheckBot Settings, tap the notification test, and verify a native status-bar notification appears.
6. Tap the notification and confirm the app returns to the foreground.
7. Start a conversation and background the app; when the conversation completes, confirm a native notification appears with the conversation title.

## Not Verified

- Android compilation and APK production (blocked by missing SDK).
- Physical installation on an Android device.
- Runtime behavior of the notification permission dialog and `POST_NOTIFICATIONS` flow.
- Tapping a notification with a specific `url` path (e.g., `/conversations/123`) and confirming the WebView loads that path.
- Web Push delivery in the WebView background.

## Risks / Limitations

- The wrapper only posts notifications while the app and WebView process are alive. When the app is fully closed or killed by the OS, no notification is shown because there is no FCM/push service.
- Web Push (`serviceWorker` + `PushManager`) may not work reliably inside an Android WebView; this implementation intentionally bypasses it.
- The runtime `POST_NOTIFICATIONS` prompt on Android 13+ may appear while the initial URL is still being checked.
- Without an Android SDK in this environment, Kotlin compilation errors could not be fully ruled out.
