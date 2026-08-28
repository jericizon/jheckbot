import { describe, it, expect } from 'vitest'
import { slugify } from '../src/utils/slugify.js'

describe('slugify', () => {
  it('converts a simple name to a slug', () => {
    expect(slugify('ExampleRepo')).toBe('examplerepo')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('My Project Name')).toBe('my-project-name')
  })

  it('removes special characters', () => {
    expect(slugify('Project!@#$%Name')).toBe('project-name')
  })

  it('handles leading/trailing hyphens', () => {
    expect(slugify('---test---')).toBe('test')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })
})
