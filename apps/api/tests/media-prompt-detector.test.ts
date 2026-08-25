import { describe, it, expect } from 'vitest'
import { detectMediaIntent, augmentPromptForMedia } from '../src/services/MediaPromptDetector.js'

describe('detectMediaIntent', () => {
  it('detects explicit screenshot requests', () => {
    expect(detectMediaIntent('take a screenshot of the homepage')).toBe('image')
    expect(detectMediaIntent('screenshot the login page')).toBe('image')
    expect(detectMediaIntent('capture the screen')).toBe('image')
    expect(detectMediaIntent('take a snapshot of /dashboard')).toBe('image')
    expect(detectMediaIntent('screen shot of the app')).toBe('image')
  })

  it('detects preview requests', () => {
    expect(detectMediaIntent('preview of the homepage')).toBe('image')
    expect(detectMediaIntent('show me a preview of the landing page')).toBe('image')
    expect(detectMediaIntent('screenshot preview of homepage')).toBe('image')
  })

  it('detects video recording requests', () => {
    expect(detectMediaIntent('record a video of the checkout flow')).toBe('video')
    expect(detectMediaIntent('screen recording of the app')).toBe('video')
    expect(detectMediaIntent('record a 5 second video of the homepage')).toBe('video')
    expect(detectMediaIntent('capture a video of the demo')).toBe('video')
    expect(detectMediaIntent('screencast the onboarding')).toBe('video')
  })

  it('prefers video when both video and screenshot terms appear', () => {
    expect(detectMediaIntent('record a video then take a screenshot')).toBe('video')
  })

  it('returns null for non-capture prompts', () => {
    expect(detectMediaIntent('show me the code for the auth module')).toBeNull()
    expect(detectMediaIntent('fix the bug in the login form')).toBeNull()
    expect(detectMediaIntent('what does the config look like')).toBeNull()
    expect(detectMediaIntent('')).toBeNull()
    expect(detectMediaIntent('   ')).toBeNull()
  })

  it('returns null when prompt already references the media dir', () => {
    expect(detectMediaIntent('take a screenshot and save to $JHECKBOT_MEDIA_DIR/x.png')).toBeNull()
    expect(detectMediaIntent('record a video to JHECKBOT_MEDIA_DIR')).toBeNull()
  })
})

describe('augmentPromptForMedia', () => {
  it('appends a save instruction for screenshot requests', () => {
    const out = augmentPromptForMedia('take a screenshot of the homepage', true)
    expect(out).toContain('take a screenshot of the homepage')
    expect(out).toContain('$JHECKBOT_MEDIA_DIR/capture.png')
    expect(out).toContain('screenshot')
  })

  it('appends a save instruction for video requests', () => {
    const out = augmentPromptForMedia('record a video of the homepage', true)
    expect(out).toContain('$JHECKBOT_MEDIA_DIR/capture.mp4')
    expect(out).toContain('record a video of')
  })

  it('returns the prompt unchanged when no capture intent', () => {
    expect(augmentPromptForMedia('fix the bug', true)).toBe('fix the bug')
  })

  it('returns the prompt unchanged when media is disabled', () => {
    expect(augmentPromptForMedia('take a screenshot of the homepage', false)).toBe(
      'take a screenshot of the homepage',
    )
  })

  it('does not double-inject when the prompt already references the media dir', () => {
    const prompt = 'take a screenshot and save to $JHECKBOT_MEDIA_DIR/home.png'
    expect(augmentPromptForMedia(prompt, true)).toBe(prompt)
  })

  it('trims trailing whitespace before appending', () => {
    const out = augmentPromptForMedia('take a screenshot   \n', true)
    expect(out).not.toContain('   \n$JHECKBOT')
    expect(out).toMatch(/screenshot\n\nSave the captured/)
  })
})
