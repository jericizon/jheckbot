# JheckBot Android Wrapper

A minimal full-screen WebView wrapper for the JheckBot Nuxt web app.

## Default URL
`http://192.168.18.12:8800`

## Build

The root build script generates `app/src/main/assets/config.json` from the
`ANDROID_APP_URL` environment variable (or `.env`) and then assembles the debug
APK.

```bash
# From the repo root
pnpm build:android

# Or, from apps/android (requires config.json to be present)
cd apps/android
./gradlew assembleDebug
```

Overridable environment variables:
- `ANDROID_APP_URL` — URL the APK loads on launch (default: `http://192.168.18.12:8800`)
- `ANDROID_HOME` — path to the Android SDK
- `JAVA_HOME` — path to a JDK (17+)

## Install
```bash
adb install installers/jheckbot-debug.apk
# or, if built directly:
adb install apps/android/app/build/outputs/apk/debug/app-debug.apk
```

## Behavior
- On launch, the app checks the saved/default URL.
- If the URL is unreachable or returns a non-2xx status, a URL input screen appears.
- Enter a working URL and tap **Save & Load**; the URL is persisted and the WebView reloads.
- When the URL works, the jheckbot web app fills the screen with no browser chrome.

## Native Notifications
- The wrapper overrides the browser `Notification` API and routes it to the Android notification manager.
- No FCM, no Firebase, and no third-party push service or subscription is required.
- Notifications appear when the web app calls `new Notification(...)` (for example, the test button in JheckBot settings or a conversation completion while the app is in the background).
- Tapping a notification opens the app and loads the conversation or page associated with the notification.
- For Android 13+, the app requests the `POST_NOTIFICATIONS` permission at launch.
