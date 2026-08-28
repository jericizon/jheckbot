import { ref, readonly, type Ref } from 'vue'

// Minimal typings for the Web Speech API (not in lib.dom by default).
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false
  // window.isSecureContext is true for HTTPS and localhost/127.0.0.1.
  return window.isSecureContext === true
}

// Map Web Speech API error codes to human-readable hints.
const ERROR_HINTS: Record<string, string> = {
  'no-speech': "Didn't hear anything. Make sure your mic is working and try again.",
  'audio-capture': 'No microphone found. Connect a mic and try again.',
  'not-allowed': 'Microphone access denied. Allow mic permission in your browser.',
  'service-not-allowed': 'Voice input blocked. Allow mic permission in your browser settings.',
  network: 'Voice service network error. Check your connection and try again.',
  aborted: 'Voice input was cancelled.',
  'bad-grammar': 'Voice input grammar error.',
  'language-not-supported': 'Selected language is not supported for voice input.',
}

/**
 * Voice-to-text via the browser Web Speech API. Recognized speech is appended
 * to the provided target ref so callers can wire it into any input field.
 *
 * Requirements: a Chromium-based browser or Safari, AND a secure context
 * (HTTPS or localhost). Firefox has no Web Speech API support.
 */
export function useVoiceInput(target: Ref<string>) {
  const supported = ref(false)
  const listening = ref(false)
  const interim = ref('')
  const error = ref('')

  let recognition: SpeechRecognitionLike | null = null
  let manualStop = false
  let restartAttempts = 0
  const MAX_RESTARTS = 5

  const ctorAvailable = getRecognitionCtor() !== null
  const secure = isSecureContext()
  // Supported only when the API exists AND we're in a secure context.
  // Web Speech API silently fails on insecure origins (e.g. LAN IP over HTTP).
  supported.value = ctorAvailable && secure

  if (import.meta.dev) {
    console.debug('[useVoiceInput] ctorAvailable=', ctorAvailable, 'secureContext=', secure, 'supported=', supported.value)
  }

  // Commit any pending interim transcript into the target ref so it isn't
  // lost when recognition stops or restarts. Browsers often don't emit a
  // final result for the last chunk before stop().
  function flushInterim() {
    const text = interim.value.trim()
    if (!text) return
    target.value = target.value
      ? `${target.value.replace(/\s+$/, '')} ${text}`
      : text
    interim.value = ''
  }

  function start(lang = 'en-US') {
    if (listening.value) return

    if (!ctorAvailable) {
      error.value = 'Voice input is not supported in this browser. Use Chrome, Edge, or Safari.'
      return
    }
    if (!secure) {
      error.value = 'Voice input requires HTTPS or localhost. Access the app via http://localhost:8800 instead of a LAN IP.'
      return
    }

    error.value = ''
    interim.value = ''
    manualStop = false
    restartAttempts = 0

    const Ctor = getRecognitionCtor()!
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i]
        if (!result) continue
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalChunk += text
        else interimChunk += text
      }
      if (finalChunk) {
        const trimmed = finalChunk.trim()
        if (trimmed) {
          target.value = target.value
            ? `${target.value.replace(/\s+$/, '')} ${trimmed}`
            : trimmed
        }
        interim.value = ''
      } else {
        interim.value = interimChunk
      }
    }

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      // aborted fires on normal stop — don't alarm the user.
      if (ev.error === 'aborted') return
      const hint = ERROR_HINTS[ev.error] || `Voice input error: ${ev.error}`
      error.value = hint
      if (import.meta.dev) {
        console.warn('[useVoiceInput] error:', ev.error, ev.message)
      }
      // Stop auto-restart loop on hard errors.
      if (ev.error !== 'no-speech') {
        manualStop = true
      }
    }

    rec.onend = () => {
      // Browser stops recognition on its own after silence or no-speech.
      // Auto-restart so the user can keep speaking without re-clicking,
      // but cap retries to avoid an infinite silent loop when the mic
      // isn't actually capturing audio.
      if (!manualStop && !error.value && restartAttempts < MAX_RESTARTS) {
        flushInterim()
        restartAttempts++
        try {
          rec.start()
          return
        } catch {
          // fall through to mark as stopped
        }
      }
      flushInterim()
      listening.value = false
    }

    try {
      rec.start()
      recognition = rec
      listening.value = true
      if (import.meta.dev) {
        console.debug('[useVoiceInput] recognition started, lang=', lang)
      }
    } catch (e) {
      error.value = 'Could not start voice input. Check microphone permissions.'
      if (import.meta.dev) {
        console.error('[useVoiceInput] start() threw:', e)
      }
    }
  }

  function stop() {
    manualStop = true
    if (recognition) {
      try {
        recognition.stop()
      } catch {
        // ignore
      }
    }
    // recognition.stop() triggers onend which flushes interim, but flush
    // here too in case onend never fires (some browsers skip it).
    flushInterim()
    listening.value = false
  }

  function toggle(lang?: string) {
    if (listening.value) stop()
    else start(lang)
  }

  function clearError() {
    error.value = ''
  }

  return {
    supported: readonly(supported),
    listening: readonly(listening),
    interim: readonly(interim),
    error: readonly(error),
    start,
    stop,
    toggle,
    clearError,
  }
}
