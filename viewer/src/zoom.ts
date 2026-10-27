export interface WheelZoomInput {
  deltaY: number
  ctrlKey: boolean
}

const MOUSE_WHEEL_SENSITIVITY = 0.00055
const PRECISION_TOUCHPAD_SENSITIVITY = 0.0022
const TOUCHPAD_PINCH_SENSITIVITY = 0.0055

export function wheelZoomFactor(input: WheelZoomInput): number {
  const delta = Math.max(-100, Math.min(100, input.deltaY))
  const sensitivity = input.ctrlKey
    ? TOUCHPAD_PINCH_SENSITIVITY
    : Math.abs(delta) < 10
      ? PRECISION_TOUCHPAD_SENSITIVITY
      : MOUSE_WHEEL_SENSITIVITY

  return Math.exp(-delta * sensitivity)
}
