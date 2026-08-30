# QA Report: JheckBot Android Wrapper

## Scope

Verify the Android wrapper builds into an installable debug APK, loads the configured LAN URL, and uses a build-time URL from `ANDROID_APP_URL` in the environment.

## Environment

- Build machine: Linux, OpenJDK 17.0.20
- Android SDK: downloaded to `/tmp/android-tooling/android-sdk` (command line tools, platform 35, build-tools 34/35)
- Gradle: 8.10.2 (downloaded to `/tmp/android-tooling/gradle-8.10.2/bin`)
- Repository branch: `feat/interactive`
- No physical Android device attached; runtime validation was not performed.

## Verification Performed

1. **Static checks**
   - `pnpm typecheck` passed for all Node workspaces.
   - `pnpm lint` passed (lint is deferred in the current workspace scripts).

2. **Build command**
   - `pnpm build:android` completed successfully.
   - The script read `ANDROID_APP_URL` from the environment (or `.env`), wrote `apps/android/app/src/main/assets/config.json`, ran `./gradlew assembleDebug`, and copied the APK to `installers/jheckbot-debug.apk`.
   - A second build with `ANDROID_APP_URL=http://10.0.0.5:9000` produced an APK containing that value in `assets/config.json`, confirming the variable is honored.
   - The final APK was rebuilt with the default `http://192.168.18.12:8800`.

3. **APK inspection**
   - `aapt dump badging installers/jheckbot-debug.apk` shows:
     - package: `com.jheckbot.wrapper`
     - versionCode: `1`, versionName: `1.0`
     - compileSdkVersion: `35`, minSdk: `24`, targetSdk: `35`
     - uses-permission: `android.permission.INTERNET`
     - launchable-activity: `com.jheckbot.wrapper.MainActivity`
   - `unzip -p installers/jheckbot-debug.apk assets/config.json` confirms the bundled config is `{"baseUrl":"http://192.168.18.12:8800"}`.
   - APK size: 3.1M.

4. **Code changes reviewed**
   - `MainActivity.kt` no longer contains a hardcoded default URL; it reads from `assets/config.json` via `AppConfig` and still persists user-entered overrides in `SharedPreferences`.
   - `res/values/strings.xml` no longer contains the IP; only a generic `url_hint`.
   - `AndroidManifest.xml` has the deprecated `package` attribute removed (namespace lives in `build.gradle.kts`).

## Not Verified

- Physical installation on an Android device.
- Runtime behavior: loading the web UI, relative `/api` proxying, and URL fallback on network failure.
- CORS and `NUXT_PUBLIC_API_BASE` runtime configuration in the user's actual LAN environment.

## Manual QA Steps for User

1. Ensure `ANDROID_APP_URL` and `NUXT_PUBLIC_API_BASE` are set in `.env` (use `.env.example` as a template):
   ```
   ANDROID_APP_URL=http://192.168.18.12:8800
   NUXT_PUBLIC_API_BASE=http://192.168.18.12:8801
   ```
2. Start the web and API: `pnpm dev`
3. On the same LAN, run `pnpm build:android` (or set `ANDROID_HOME` and `JAVA_HOME` if they are not in common locations).
4. Install to device: `adb install installers/jheckbot-debug.apk`
5. Launch the app and confirm the JheckBot web UI loads.
6. Stop the server and relaunch the app; confirm the URL input appears.
7. Enter a working URL and save; confirm the WebView reloads and the URL persists.

## Risks / Limitations

- The build in this session used a temporary Android SDK and Gradle installation. For a persistent workflow, the user's build machine needs Android SDK and Gradle (or the committed wrapper) installed.
- `CORS_ORIGIN` in `.env` may need to be set to `http://192.168.18.12:8800` if the app makes any direct (non-proxied) API calls from the WebView.
- The app permits cleartext HTTP for LAN-only development; this must be removed and HTTPS used for any production/public release.
- `gradle wrapper` generated `gradlew`, `gradlew.bat`, and `gradle/wrapper/gradle-wrapper.jar` in this session. These files can be committed so the project builds without a system `gradle` command.
