import { describe, expect, it } from 'vitest'
import { wheelZoomFactor } from '../viewer/src/zoom'

describe('viewer zoom input', () => {
  it('keeps mouse wheel zoom restrained', () => {
    expect(wheelZoomFactor({ deltaY: -100, ctrlKey: false })).toBeCloseTo(1.0565, 3)
    expect(wheelZoomFactor({ deltaY: 100, ctrlKey: false })).toBeCloseTo(0.9465, 3)
  })

  it('accelerates precision touchpad scrolling', () => {
    const mouseLike = wheelZoomFactor({ deltaY: -5, ctrlKey: false })
    const wheelRate = Math.exp(5 * 0.00055)

    expect(mouseLike).toBeGreaterThan(wheelRate)
  })

  it('accelerates touchpad pinch gestures', () => {
    const pinch = wheelZoomFactor({ deltaY: -5, ctrlKey: true })
    const precisionScroll = wheelZoomFactor({ deltaY: -5, ctrlKey: false })

    expect(pinch).toBeGreaterThan(precisionScroll)
  })
})
