import { describe, expect, it } from 'vitest'
import { normalizeOptionList, parseFieldDefinition, parseKeyValue } from '../src/utils'

describe('parseKeyValue', () => {
  it('should parse normal properties as string', () => {
    const parsed = parseKeyValue(['status=active', 'timezone=+8'])
    expect(parsed).toEqual({
      status: 'active',
      timezone: '+8'
    })
  })

  it('should parse array fields from schema provided set', () => {
    const parsed = parseKeyValue(['tags=1997,backend, cli'], ['tags'])
    expect(parsed).toEqual({
      tags: ['1997', 'backend', 'cli']
    })
  })

  it('should keep comma value as string when field is not array', () => {
    const parsed = parseKeyValue(['owner=a,b'])
    expect(parsed).toEqual({
      owner: 'a,b'
    })
  })

  it('should parse number fields to number', () => {
    const parsed = parseKeyValue(['retry=3'], [], ['retry'])
    expect(parsed).toEqual({
      retry: 3
    })
  })
})

describe('normalizeOptionList', () => {
  it('should normalize undefined to empty array', () => {
    expect(normalizeOptionList(undefined)).toEqual([])
  })

  it('should normalize string to single item array', () => {
    expect(normalizeOptionList('timezone=+8')).toEqual(['timezone=+8'])
  })

  it('should keep array input as is', () => {
    expect(normalizeOptionList(['a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('parseFieldDefinition', () => {
  it('should parse semicolon separated field config', () => {
    expect(parseFieldDefinition('name=model;type=array;required=true;enum=a,b')).toEqual({
      name: 'model',
      type: 'array',
      required: true,
      enum: ['a', 'b']
    })
  })

  it('should default required to false by omission', () => {
    expect(parseFieldDefinition('name=api_key;type=string')).toEqual({
      name: 'api_key',
      type: 'string'
    })
  })

  it('should throw when name or type missing', () => {
    expect(() => parseFieldDefinition('type=string')).toThrow('missing "name"')
    expect(() => parseFieldDefinition('name=api_key')).toThrow('missing "type"')
  })
})
