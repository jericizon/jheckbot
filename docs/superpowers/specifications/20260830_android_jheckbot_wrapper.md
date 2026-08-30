# Spec: JheckBot Android Wrapper

## Objective

Package the existing JheckBot Nuxt web app as an installable Android debug APK. The APK opens a full-screen WebView and loads the web app from the LAN URL `http://192.168.18.12:8800`. The default URL, the Nuxt API proxy target, and the CORS origin must be configurable at build time through the `ANDROID_APP_URL` and `NUXT_PUBLIC_API_BASE` environment variables without hardcoding secrets or overwriting an existing `.env`.

## Tech Stack

- Kotlin / Android Gradle Plugin 8.7.0 / compileSdk 35 / minSdk 24
- Gradle with generated wrapper (`gradle wrapper` when `gradlew` is missing)
- pnpm / bash for the root build command
- Existing Nuxt 4 dev proxy for same-origin `/api` requests

## Commands

- `pnpm build:android` — validate env, inject the URL into the Android build, assemble debug APK, and copy the artifact to `installers/jheckbot-debug.apk`.
- `cd apps/android && ./gradlew assembleDebug` — lower-level debug build after the wrapper is generated and the URL is injected.
- `adb install apps/android/app/build/outputs/apk/debug/app-debug.apk` — install to device.

## Project Structure

```
jheckbot/
├── package.json                        # adds pnpm build:android script
├── scripts/build-android.sh            # new build orchestration script
├── .env.example                        # adds ANDROID_APP_URL and NUXT_PUBLIC_API_BASE defaults
├── apps/android/
│   ├── app/src/main/assets/config.json # generated/injected at build time
│   ├── app/src/main/java/com/jheckbot/wrapper/MainActivity.kt
│   ├── app/src/main/res/values/strings.xml
│   ├── app/src/main/AndroidManifest.xml
│   └── ...
└── apps/web/nuxt.config.ts             # uses NUXT_PUBLIC_API_BASE with LAN default
```

## Code Style

- Keep `MainActivity.kt` plain and minimal; configuration comes from `assets/config.json` which the build script generates from the environment.
- User-facing text lives in `strings.xml`.
- Build script exits early with clear errors if `ANDROID_APP_URL` or required tooling is missing.

## Testing Strategy

- Build-time: verify `pnpm build:android` produces an APK at a predictable path.
- Static: `pnpm typecheck` and `pnpm lint` where applicable; `gradlew` compile/checks where available.
- Runtime (device/ emulator required): install the APK, confirm the app loads `http://192.168.18.12:8800`, and confirm `/api` traffic reaches the API over the LAN.

## Boundaries

- Always:
  - Read the target URL from `ANDROID_APP_URL` (fallback `http://192.168.18.12:8800`).
  - Read the API proxy target from `NUXT_PUBLIC_API_BASE` (fallback `http://192.168.18.12:8801`) for mobile builds.
  - Generate the Android `assets/config.json` from the build environment.
  - Keep the existing URL-input fallback in `MainActivity.kt`.
  - Preserve any existing root `.env` and do not write secrets into the APK.
- Ask first:
  - Adding release signing, Capacitor, bundled web assets, or push notifications.
  - Changing `minSdk` / targetSdk.
- Never:
  - Overwrite an existing `.env` file.
  - Commit a real `.env` or signing keystore.
  - Allow `file://`, `javascript:`, or untrusted schemes in the URL input.

## Success Criteria

1. `pnpm build:android` completes without starting a server and produces an installable debug APK.
2. The default APK loads `http://192.168.18.12:8800`; the URL can be changed via `ANDROID_APP_URL`.
3. `NUXT_PUBLIC_API_BASE` can be set to `http://192.168.18.12:8801` so relative `/api` calls from the WebView proxy correctly on the LAN.
4. `.env.example` documents both variables; the existing `.env` is not modified.
5. The app can be installed with `adb install` and launches on an Android device.
6. The app’s URL-input fallback still works when the configured URL is unreachable.
7. No unrelated existing changes are lost or overwritten.

## Open Questions

- Is the Android SDK + JDK installed in this environment, or will build verification require a separate machine?
- Is `192.168.18.12` the host’s current LAN IP, and is the phone on the same subnet?
