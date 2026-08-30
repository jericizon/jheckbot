# Plan: JheckBot Android Wrapper

## Overview

Complete the existing `apps/android` Kotlin WebView wrapper so it can be built as an installable debug APK via a root pnpm command. The build must read `ANDROID_APP_URL` from the environment, write it into the Android `assets/config.json`, and use `NUXT_PUBLIC_API_BASE` to make the Nuxt `/api` proxy work over the LAN. The existing in-app URL-input fallback and persistence must remain intact.

## Architecture decisions

- Adopt the Adzeela native-wrapper pattern: an `assets/config.json` injected at build time instead of hardcoded strings.
- Keep JheckBot’s existing URL-input fallback so a failing URL can be corrected on-device.
- Do not use Capacitor or bundled assets; the APK is a thin WebView shell that loads a remote/LAN URL.
- The root `.env` is never modified; `.env.example` is updated so users can set `ANDROID_APP_URL` and `NUXT_PUBLIC_API_BASE`.

## Task list

### Task 1: Add environment variables to `.env.example`
- Add `ANDROID_APP_URL=http://192.168.18.12:8800`
- Add `NUXT_PUBLIC_API_BASE=http://192.168.18.12:8801`
- Leave all existing values and comments intact.

**Acceptance:** `.env.example` documents both variables with the LAN defaults.

**Verify:** `git diff .env.example` shows only the two added lines.

**Files touched:** `.env.example`

### Task 2: Update Nuxt proxy configuration for LAN
- Change `apps/web/nuxt.config.ts` so `runtimeConfig.public.apiBase` and the `/api/**` proxy use `NUXT_PUBLIC_API_BASE` with a LAN-friendly default.

**Acceptance:** When `NUXT_PUBLIC_API_BASE=http://192.168.18.12:8801`, the Nuxt dev proxy forwards `/api` to that LAN address.

**Verify:** `pnpm --filter @jheckbot/web typecheck` passes; config diff reviewed.

**Files touched:** `apps/web/nuxt.config.ts`

### Task 3: Generate Android `assets/config.json` and read it in the wrapper
- Add `app/src/main/assets/config.json` as a template or build-time generated file.
- Add `AppConfig.kt` to load `baseUrl` and `apiBaseUrl` from `assets/config.json` with fallback defaults.
- Update `MainActivity.kt` to use `AppConfig` instead of hardcoded `DEFAULT_URL`.
- Keep the URL-input fallback behavior and persistence.

**Acceptance:** The wrapper reads its default URL from `assets/config.json` and still lets the user override it.

**Verify:** Kotlin compiles; `MainActivity.kt` no longer contains the hardcoded `192.168.18.12` string.

**Files touched:** `apps/android/app/src/main/java/com/jheckbot/wrapper/AppConfig.kt` (new), `apps/android/app/src/main/java/com/jheckbot/wrapper/MainActivity.kt`, `apps/android/app/src/main/assets/config.json` (new)

### Task 4: Create the root build script and pnpm command
- Add `scripts/build-android.sh` that:
  - Reads `ANDROID_APP_URL` and `NUXT_PUBLIC_API_BASE` from the environment or `.env`.
  - Generates `apps/android/app/src/main/assets/config.json`.
  - Runs `gradle wrapper` in `apps/android` if `gradlew` is missing.
  - Runs `./gradlew assembleDebug`.
  - Copies the APK to `installers/jheckbot-debug.apk`.
- Add `build:android` to root `package.json`.

**Acceptance:** `pnpm build:android` assembles the debug APK at a predictable path without starting a server.

**Verify:** Dry-run the script with env vars; confirm config file generation and APK path logic.

**Files touched:** `package.json`, `scripts/build-android.sh` (new), `.gitignore` (for installers/ if needed)

### Task 5: Static verification
- Run `pnpm typecheck` and `pnpm lint` for affected Node workspaces.
- Attempt `cd apps/android && ./gradlew assembleDebug` if Android SDK is available; if not, record the limitation.
- Inspect the built APK path and `aapt dump` the manifest if possible.

**Acceptance:** No regressions in Node code; Android build is attempted and the result is documented.

**Verify:** `pnpm typecheck`, `pnpm lint`; build output.

**Files touched:** None (verification only)

### Task 6: QA on device / emulator
- Install the debug APK on an Android device with `adb install`.
- Launch the app and confirm it loads `http://192.168.18.12:8800`.
- Confirm `/api` calls proxy to the LAN API.
- Test the URL fallback by stopping the server and relaunching.

**Acceptance:** App installs, loads the web UI, and survives network fallback.

**Verify:** Manual QA report in `docs/superpowers/qa/20260830_android_jheckbot_wrapper.md`.

**Files touched:** `docs/superpowers/qa/20260830_android_jheckbot_wrapper.md`

## Checkpoint: After Tasks 1–4

- [ ] `.env.example` updated.
- [ ] Nuxt config uses `NUXT_PUBLIC_API_BASE` with LAN default.
- [ ] Android wrapper reads URL from generated `config.json`.
- [ ] `pnpm build:android` exists and runs without starting a server.

## Checkpoint: Complete

- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] Debug APK is produced at `installers/jheckbot-debug.apk` (or environment limitation is documented).
- [ ] QA report documents device/emulator results.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Android SDK/JDK not installed in this environment | High | Document the limitation; validate the build script logic and let the user run on a machine with the SDK. |
| Existing `.env` already has values that conflict with new defaults | Medium | Only edit `.env.example`; never overwrite `.env`. |
| Nuxt proxy change breaks `localhost` dev | Medium | Keep a sensible default; use `process.env` at build/dev time. |
| CORS origin in API is `localhost:8800` | High | Update `CORS_ORIGIN` in `.env.example` to `http://192.168.18.12:8800` and document that the API must be restarted with the correct env. |
| Hardcoded strings remain in APK after build | Low | Build script generates `config.json`; grep for `192.168.18.12` in `apps/android/app/src/main` to verify. |

## Open questions

- Does this environment have Android SDK / JDK to produce the APK?
- Is the target Android device on the same 192.168.18.x subnet?
