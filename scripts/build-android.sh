#!/usr/bin/env bash
#
# Build the JheckBot Android debug APK.
#
# Overridable env vars:
#   ANDROID_APP_URL   URL the APK loads at launch (default: http://192.168.18.12:8800)
#   ANDROID_HOME      Android SDK location
#   JAVA_HOME         JDK location
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$REPO_ROOT/apps/android"
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
INSTALLERS_DIR="$REPO_ROOT/installers"

# Read ANDROID_APP_URL from .env only when it is not already in the environment.
# We do not source the whole .env file to avoid leaking unrelated secrets into
# the build process.
if [ -z "${ANDROID_APP_URL:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
  ANDROID_APP_URL=$(grep -E '^ANDROID_APP_URL=' "$REPO_ROOT/.env" 2>/dev/null | tail -1 | sed 's/^ANDROID_APP_URL=//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//' || true)
  export ANDROID_APP_URL
fi

ANDROID_APP_URL="${ANDROID_APP_URL:-http://192.168.18.12:8800}"

# --- sanity checks -----------------------------------------------------------
if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: java not found. Install a JDK (17+) and ensure it is on PATH." >&2
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  for d in "$HOME/android-sdk" "$HOME/Android/Sdk" "$HOME/Library/Android/sdk"; do
    [ -d "$d" ] && export ANDROID_HOME="$d" && break
  done
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME not set and no Android SDK found in common locations." >&2
  exit 1
fi

export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# --- inject build-time configuration -----------------------------------------
mkdir -p "$ASSETS_DIR"
cat > "$ASSETS_DIR/config.json" <<EOF
{
  "baseUrl": "$ANDROID_APP_URL"
}
EOF
echo "==> Injected ANDROID_APP_URL=$ANDROID_APP_URL into $ASSETS_DIR/config.json"

# --- ensure Gradle wrapper exists --------------------------------------------
if [ ! -x "$ANDROID_DIR/gradlew" ]; then
  echo "==> Gradle wrapper not found; generating it (requires a local 'gradle' command)"
  if ! command -v gradle >/dev/null 2>&1; then
    echo "ERROR: 'gradle' command not found and '$ANDROID_DIR/gradlew' is missing." >&2
    echo "       Install Gradle or commit the wrapper files (gradlew + gradle/wrapper/gradle-wrapper.jar)." >&2
    exit 1
  fi
  (cd "$ANDROID_DIR" && gradle wrapper)
fi

# --- build debug APK ---------------------------------------------------------
echo "==> Assembling debug APK"
(cd "$ANDROID_DIR" && ./gradlew assembleDebug --no-daemon)

# --- copy installer ----------------------------------------------------------
mkdir -p "$INSTALLERS_DIR"
SRC="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
DEST="$INSTALLERS_DIR/jheckbot-debug.apk"
cp "$SRC" "$DEST"

echo ""
echo "Done. APK saved to: $DEST"
echo "Install with: adb install $DEST"
