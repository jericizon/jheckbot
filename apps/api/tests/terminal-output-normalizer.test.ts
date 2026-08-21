import { describe, expect, it } from 'vitest'
import { TerminalOutputNormalizer } from '../src/agent/TerminalOutputNormalizer.js'

const observedDevinOutput = [
  '\u001b[2J\u001b[H⠀⣴⣾⣶⡄',
  'Devin CLI',
  '❭ test',
  'GLM-5.2 High                       Use /help to see all available slash commands',
  'GLM-5.2 High                                    Context: 20k / 200k tokens (10%)',
  '────────────────────────────────────────────────────────────────',
  'Inspecting package.json...',
  'Running pnpm test...',
  '✓ Unicode output: 日本語',
]

describe('TerminalOutputNormalizer', () => {
  it('removes observed Devin TUI chrome while preserving meaningful Unicode output', () => {
    const normalized = new TerminalOutputNormalizer().normalize(observedDevinOutput)

    expect(normalized).toContain('Inspecting package.json...')
    expect(normalized).toContain('Running pnpm test...')
    expect(normalized).toContain('✓ Unicode output: 日本語')
    expect(normalized).not.toContain('Devin CLI')
    expect(normalized).not.toContain('❭ test')
    expect(normalized).not.toContain(
      'GLM-5.2 High                       Use /help to see all available slash commands',
    )
    expect(normalized).not.toContain(
      'GLM-5.2 High                                    Context: 20k / 200k tokens (10%)',
    )
    expect(normalized).not.toContain(
      '────────────────────────────────────────────────────────────────',
    )
    expect(normalized).not.toContain('⠀⣴⣾⣶⡄')
  })

  it('strips terminal controls and keeps the final carriage-return redraw', () => {
    const normalized = new TerminalOutputNormalizer().normalize([
      '\u001b]0;Devin\u0007',
      'working...\rDone ✓',
      '\u001b[32mProject output\u001b[0m',
      '   ',
      'Devin CLI tools are documented here',
    ])

    expect(normalized).toEqual([
      'Done ✓',
      'Project output',
      'Devin CLI tools are documented here',
    ])
  })

  it('returns only lines appended to a normalized snapshot', () => {
    const normalizer = new TerminalOutputNormalizer()
    const previous = normalizer.normalize(['Inspecting package.json...'])
    const current = normalizer.normalize([
      'Inspecting package.json...',
      'Running pnpm test...',
    ])

    expect(normalizer.delta(previous, current)).toEqual(['Running pnpm test...'])
    expect(normalizer.delta(current, current)).toEqual([])
  })

  it('deduplicates a repeated normalized snapshot while retaining new content', () => {
    const normalizer = new TerminalOutputNormalizer()
    const previous = ['Inspecting package.json...', 'Running pnpm test...']
    const repeatedWithNewContent = [...previous, ...previous, 'All tests passed']

    expect(normalizer.delta(previous, repeatedWithNewContent)).toEqual(['All tests passed'])
    expect(normalizer.delta(previous, [...previous, ...previous])).toEqual([])
  })

  it('filters SWE-1.7 CLI chrome (spinner, help text, model header)', () => {
    const sweOutput = [
      '⠇⠀ Thinking · 0s (esc twice to interrupt)',
      'SWE-1.7  Type while the agent works to queue messages; press Enter on an empty',
      'Max      input to send them now',
      'SWE-1.7 Max                       Use /help to see all available slash commands',
      'SWE-1.7 Max                                    Context: 10k / 262k tokens (4%)',
      '────────────────────────────────────────────────────────────────',
      'Analyzing the codebase...',
      '⠋⠀ Thinking · 3s (esc twice to interrupt)',
      'Found the issue in src/index.ts',
    ]

    const normalized = new TerminalOutputNormalizer().normalize(sweOutput)

    expect(normalized).toContain('Analyzing the codebase...')
    expect(normalized).toContain('Found the issue in src/index.ts')
    expect(normalized).not.toContain('Thinking')
    expect(normalized).not.toContain('Type while the agent works')
    expect(normalized).not.toContain('input to send them now')
    expect(normalized).not.toContain('Use /help')
    expect(normalized).not.toContain('Context:')
  })

  it('filters tmux remain-on-exit pane-dead notices', () => {
    const output = [
      'pong',
      'Pane is dead (status 0, Fri Aug 21 22:06:29 2026)',
    ]

    const normalized = new TerminalOutputNormalizer().normalize(output)

    expect(normalized).toEqual(['pong'])
    expect(normalized).not.toContain('Pane is dead')
  })
})
