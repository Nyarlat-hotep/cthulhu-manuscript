import { GLYPH_MAP } from '../data/text.js'

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

const SEPIA = hexToRgb('#c8a882')
const GREEN = hexToRgb('#6ddd72')

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Smooth sepia → green gradient around the tentacle
export function getProximityTextColor(proximity) {
  const t = smoothstep(0.08, 0.92, proximity)
  if (t === 0) return '#c8a882'
  const r = Math.round(SEPIA[0] + (GREEN[0] - SEPIA[0]) * t)
  const g = Math.round(SEPIA[1] + (GREEN[1] - SEPIA[1]) * t)
  const b = Math.round(SEPIA[2] + (GREEN[2] - SEPIA[2]) * t)
  return `rgb(${r},${g},${b})`
}

function hash(a, b, c) {
  let h = ((a * 2654435761) ^ (b * 40503) ^ (c * 1013904223)) >>> 0
  h ^= h >>> 16
  return (h >>> 0) / 0xffffffff
}

// Subtle glyph substitution — only close characters, staggered per-character so they
// don't all switch at once
export function substituteByProximity(ch, charIndex, lineIndex, proximity, time) {
  if (proximity < 0.55) return ch
  const sub = GLYPH_MAP[ch]
  if (!sub) return ch
  const t = (proximity - 0.55) / 0.45
  // Each character has its own offset so changes are staggered, not simultaneous
  const offset = hash(lineIndex, charIndex, 99) * 7.0
  const timeSeed = Math.floor((time + offset) / 7.0)
  return hash(lineIndex, charIndex, timeSeed) < t * 0.22 ? sub : ch
}
