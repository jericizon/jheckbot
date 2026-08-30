# Spec: Native Android Notifications for JheckBot Wrapper

## Objective

Allow the JheckBot Android WebView wrapper to show **native Android status-bar notifications** when the web app uses the browser `Notification` API (e.g., conversation completion, the notification test button). The implementation must be free, self-hosted, and require no third-party push service or subscription.

## Tech Stack

- Kotlin / Android Gradle Plugin 8.7.0 / compileSdk 35 / minSdk 24
- `androidx.core` `NotificationManagerCompat` and `NotificationCompat`
- `WebView.addJavascriptInterface` for the web-to-native bridge
- Existing `useNotifications.ts` composable in `apps/web`

## Architecture

The wrapper injects a JavaScript bridge named `AndroidBridge` into the WebView. After each page finishes loading, the wrapper also injects a small JS shim that replaces the browser `Notification` constructor and `Notification.requestPermission` so the web app can call them exactly as it does today, but the wrapper surfaces the result as a native Android notification.

### JS Bridge API

| Method | Arguments | Purpose |
|--------|-----------|---------|
| `AndroidBridge.showNotification(title, body, tag, url)` | `title`, `body`, `tag`, `url` are strings | Post a native notification. Tapping it opens the app. |
| `AndroidBridge.permission()` | none | Returns `"granted"` or `"denied"` based on the system notification setting. |
| `AndroidBridge.requestPermission()` | none | Returns the current permission. The actual runtime permission is requested at app start. |

### Native Android Flow

1. `MainActivity.onCreate` creates a notification channel and requests `POST_NOTIFICATIONS` at runtime when needed (Android 13+).
2. `MainActivity` adds `NotificationBridge` as `AndroidBridge` to the WebView and injects the JS shim in `WebViewClient.onPageFinished`.
3. Web app calls `new Notification(title, { body, tag, url, ... })`.
4. The shim calls `AndroidBridge.showNotification(...)`.
5. `NotificationBridge` posts a `NotificationCompat` notification using the small icon `R.drawable.ic_notification`.
6. Tapping the notification launches `MainActivity`, which loads the target `url` if one is provided.

## Permissions

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Runtime request is required on Android 13 (API 33) and newer.

## Web App Integration

No functional web app changes are required for the bridge to work. The wrapper's injected JS handles `Notification` at runtime. The `apps/web/app/composables/useNotifications.ts` composable may optionally declare the `window.AndroidBridge` interface so TypeScript remains clean, but its runtime behavior is unchanged.

## Files Touched

- `apps/android/app/src/main/java/com/jheckbot/wrapper/MainActivity.kt`
- `apps/android/app/src/main/java/com/jheckbot/wrapper/NotificationBridge.kt` (new)
- `apps/android/app/src/main/java/com/jheckbot/wrapper/NotificationConstants.kt` (new)
- `apps/android/app/src/main/AndroidManifest.xml`
- `apps/android/app/src/main/res/values/strings.xml`
- `apps/android/app/src/main/res/drawable/ic_notification.xml` (new)
- `apps/android/README.md`
- `apps/web/app/composables/useNotifications.ts` (optional type declaration only)

## Testing Strategy

- Web build: `pnpm --filter @jheckbot/web build` must pass.
- Android static: `cd apps/android && ./gradlew assembleDebug` when Android SDK is available.
- Runtime (device required): install the APK, open JheckBot Settings, tap the notification test, and verify a native status-bar notification appears.
- Runtime: start a conversation, background the app, and verify a native notification appears when the conversation finishes.

## Boundaries

- Always:
  - Keep the implementation free of FCM, Firebase, or any external push service.
  - Preserve the existing URL-input fallback and WebView configuration.
  - Reuse the existing `Notification` API so the web app needs no logic change.
- Ask first:
  - Adding FCM for closed-app push.
  - Bundling a foreground service to keep the WebView alive.
- Never:
  - Store notification content persistently.
  - Send data to third-party services.
  - Request permissions at times that interrupt the initial URL check.

## Success Criteria

1. The web app can call `new Notification(...)` in the wrapper and a native Android notification is posted.
2. `Notification.permission` and `Notification.requestPermission()` in the wrapper reflect the Android notification setting.
3. Tapping a native notification brings the app to the foreground.
4. If a `url` is provided (e.g., `/conversations/123`), the app loads that path when the notification is tapped.
5. No FCM, no backend changes, no subscription.
6. Web and Android builds pass.

## Limitations

- Notifications are delivered only while the wrapper process and WebView are alive. When the app is fully closed or killed by the OS, no notification is received because there is no FCM/push service.
- Web Push (`serviceWorker` + `PushManager`) may not be reliable inside an Android WebView; this implementation does not depend on it.
