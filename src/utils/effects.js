import { GLYPH_MAP } from '../data/text.js'

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB)
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r},${g},${bl})`
}

// Eased sanity — Part I feels longer, Part III accelerates
export function easeSanity(raw) {
  return Math.pow(Math.max(0, Math.min(1, raw)), 1.3)
}

// Background colour: warm dark brown → sickly near-black green
export function getBackgroundColor(sanity) {
  return lerpColor('#2a1f0e', '#080f06', Math.min(1, sanity * 0.7))
}

// Text colour: warm sepia → sickly pale green
export function getTextColor(sanity) {
  if (sanity < 0.5) return lerpColor('#c8a882', '#b89a70', sanity * 2)
  return lerpColor('#b89a70', '#7aae6a', (sanity - 0.5) * 2)
}

// clearRect alpha — creates ink trail at high sanity
export function getClearAlpha(sanity) {
  return sanity > 0.7 ? 0.91 : 1.0
}

// ── Ink bleed ─────────────────────────────────────────────────────────────────

export function applyInkBleed(ctx, sanity) {
  if (sanity < 0.2) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; return }
  const t = Math.min(1, (sanity - 0.2) / 0.6)
  ctx.shadowColor = getTextColor(sanity)
  ctx.shadowBlur = t * 10
}

export function resetBleed(ctx) {
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

// ── Line oscillation ──────────────────────────────────────────────────────────

export function getLineOscillation(lineIndex, sanity, time) {
  if (sanity < 0.3) return 0
  const t = Math.min(1, (sanity - 0.3) / 0.7)
  const maxAmp = t * 9
  return Math.sin(time * 0.38 + lineIndex * 0.53) * maxAmp
}

// ── Glyph drift ───────────────────────────────────────────────────────────────

// charWidthCache: Map<string, number> — populated lazily, keyed by char
export function drawGlyphDrift(ctx, x, y, text, sanity, time, lineIndex, charWidthCache) {
  if (sanity < 0.28) {
    ctx.fillText(text, x, y)
    return
  }

  const t = Math.min(1, (sanity - 0.28) / 0.72)
  const maxDrift = Math.pow(t, 1.4) * 26

  let curX = x
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    let w = charWidthCache.get(ch)
    if (w === undefined) {
      w = ctx.measureText(ch).width
      charWidthCache.set(ch, w)
    }
    const phase = lineIndex * 1.31 + i * 0.73
    const dx = Math.sin(time * 0.82 + phase) * maxDrift
    const dy = Math.cos(time * 0.61 + phase * 1.17) * maxDrift * 0.45
    ctx.fillText(ch, curX + dx, y + dy)
    curX += w
  }
}

// ── Deterministic hash ────────────────────────────────────────────────────────

function hash(a, b, c) {
  let h = ((a * 2654435761) ^ (b * 40503) ^ (c * 1013904223)) >>> 0
  h ^= h >>> 16
  return (h >>> 0) / 0xffffffff
}

// ── Glyph substitution ────────────────────────────────────────────────────────

export function substituteGlyphs(text, sanity, time, lineIndex) {
  if (sanity < 0.55) return text
  const t = Math.min(1, (sanity - 0.55) / 0.4)
  const timeSeed = Math.floor(time / 2.5)
  return text.split('').map((ch, i) => {
    const sub = GLYPH_MAP[ch]
    if (!sub) return ch
    return hash(lineIndex, i, timeSeed) < t * 0.38 ? sub : ch
  }).join('')
}

// ── Word reversal ─────────────────────────────────────────────────────────────

export function maybeReverseWords(text, sanity, lineIndex) {
  if (sanity < 0.68) return text
  const t = (sanity - 0.68) / 0.32
  if (hash(lineIndex, 777, 0) > t * 0.22) return text
  return text.split(' ').map((w, wi) =>
    hash(lineIndex, wi, 1) < 0.5 ? w.split('').reverse().join('') : w
  ).join(' ')
}
