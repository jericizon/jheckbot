const ANSI_OSC = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g
const ANSI_CSI = /\u001b\[[0-?]*[ -/]*[@-~]/g
const ANSI_ESCAPE = /\u001b(?:[@-_])/g
const TERMINAL_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

/** Converts captured interactive terminal lines into chat-safe text. */
export class TerminalOutputNormalizer {
  static normalize(lines: string[]): string[] {
    return lines.flatMap((line) => TerminalOutputNormalizer.normalizeLine(line))
  }

  static delta(previous: string[], current: string[]): string[] {
    const previousNormalized = TerminalOutputNormalizer.normalize(previous)
    const currentNormalized = TerminalOutputNormalizer.normalize(current)

    let commonPrefixLength = 0
    while (
      commonPrefixLength < previousNormalized.length &&
      commonPrefixLength < currentNormalized.length &&
      previousNormalized[commonPrefixLength] === currentNormalized[commonPrefixLength]
    ) {
      commonPrefixLength += 1
    }

    let deltaStart = commonPrefixLength
    while (
      previousNormalized.length > 0 &&
      deltaStart + previousNormalized.length <= currentNormalized.length &&
      TerminalOutputNormalizer.sameSnapshot(
        previousNormalized,
        currentNormalized.slice(deltaStart, deltaStart + previousNormalized.length),
      )
    ) {
      deltaStart += previousNormalized.length
    }

    return currentNormalized.slice(deltaStart)
  }

  normalize(lines: string[]): string[] {
    return TerminalOutputNormalizer.normalize(lines)
  }

  delta(previous: string[], current: string[]): string[] {
    return TerminalOutputNormalizer.delta(previous, current)
  }

  private static sameSnapshot(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((line, index) => line === right[index])
  }

  private static normalizeLine(line: string): string[] {
    const cleaned = line
      .replace(/\r\n/g, '\n')
      .replace(ANSI_OSC, '')
      .replace(ANSI_CSI, '')
      .replace(ANSI_ESCAPE, '')
      .replace(TERMINAL_CONTROLS, '')

    return cleaned.split('\n').flatMap((part) => {
      const redrawn = TerminalOutputNormalizer.lastCarriageReturnValue(part)
      const withoutPadding = redrawn.replace(/\s+$/u, '')
      if (!withoutPadding.trim() || TerminalOutputNormalizer.isKnownChrome(withoutPadding)) {
        return []
      }
      return [withoutPadding]
    })
  }

  private static lastCarriageReturnValue(line: string): string {
    const parts = line.split('\r')
    const lastPart = parts[parts.length - 1]
    if (lastPart.length > 0) return lastPart
    return [...parts].reverse().find((part) => part.length > 0) ?? ''
  }

  private static isKnownChrome(line: string): boolean {
    const trimmed = line.trim()

    if (trimmed === 'Devin CLI' || trimmed === '⠀⣴⣾⣶⡄') return true
    if (/^[❭❯](?:\s|$)/u.test(trimmed)) return true
    if (/^GLM-5\.2 High\s+Use \/help to see all available slash commands$/u.test(trimmed)) {
      return true
    }
    if (/^GLM-5\.2 High\s+Context:\s+\d+[kKmM]?\s*\/\s*\d+[kKmM]?\s+tokens\s+\(\d+%\)$/u.test(trimmed)) {
      return true
    }
    if (/^[─━═]+$/u.test(trimmed)) return true

    return false
  }
}
