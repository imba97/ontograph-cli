import { describe, expect, it } from 'vitest'
import { parseKeyValue } from '../src/utils'

describe('parseKeyValue', () => {
  it('should parse normal properties as string', () => {
    const parsed = parseKeyValue(['status=active', 'timezone=+8'])
    expect(parsed).toEqual({
      status: 'active',
      timezone: '+8'
    })
  })

  it('should parse tags as string array', () => {
    const parsed = parseKeyValue(['tags=1997,backend, cli'])
    expect(parsed).toEqual({
      tags: ['1997', 'backend', 'cli']
    })
  })
})
