import { MARGIN_H, LINE_HEIGHT } from './layout.js'
import { getBackgroundColor, getTextColor, getClearAlpha } from './effects.js'

// ── Background ────────────────────────────────────────────────────────────────

export function clearCanvas(ctx, w, h, sanity, bgColor) {
  const alpha = getClearAlpha(sanity)
  if (alpha >= 1) {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, w, h)
  } else {
    // Semi-transparent fill for ink trail effect
    const [r, g, b] = bgColor.match(/\d+/g).map(Number)
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fillRect(0, 0, w, h)
  }
}

// ── Paper grain ───────────────────────────────────────────────────────────────

// Fast LCG seeded per-frame for animated grain
let _grainSeed = 1

export function drawGrain(ctx, w, h, sanity) {
  const intensity = 0.025 + sanity * 0.055
  const cellSize = 3
  _grainSeed = (_grainSeed * 1664525 + 1013904223) & 0x7fffffff

  ctx.save()
  const cols = Math.ceil(w / cellSize)
  const rows = Math.ceil(h / cellSize)
  let s = _grainSeed

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      s = (s * 1664525 + 1013904223) & 0x7fffffff
      const v = (s >>> 0) / 0x7fffffff
      if (v > 0.6) {
        const a = (v - 0.6) * intensity * 2.5
        ctx.fillStyle = `rgba(255,230,180,${a})`
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
      }
    }
  }
  ctx.restore()
}

// ── Vignette ──────────────────────────────────────────────────────────────────

export function drawVignette(ctx, w, h, sanity) {
  const strength = 0.30 + sanity * 0.60
  const cx = w / 2, cy = h / 2
  const r0 = Math.min(w, h) * 0.15
  const r1 = Math.sqrt(cx * cx + cy * cy) * 1.1
  const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

// ── Section heading ───────────────────────────────────────────────────────────

const SECTION_TITLES = [
  'I. The Horror in Clay',
  'II. The Tale of Inspector Legrasse',
  'III. The Madness from the Sea',
]

// Draw the chapter title above the first line of each part
export function drawSectionHeading(ctx, w, scrollTop, items, sanity) {
  if (items.length === 0) return
  const headingAlpha = Math.max(0.12, 0.45 - sanity * 0.3)
  ctx.save()
  ctx.font = '13px "IM Fell English"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = `rgba(200, 168, 130, ${headingAlpha})`

  // Find the y position of the first line of each part and render heading 28px above it
  const partStarts = [null, null, null]
  for (const item of items) {
    if (partStarts[item.partIndex] === null) {
      partStarts[item.partIndex] = item.y
    }
  }

  for (let pi = 0; pi < 3; pi++) {
    if (partStarts[pi] === null) continue
    const hy = partStarts[pi] - 28 - scrollTop
    if (hy < -40 || hy > ctx.canvas.height / (window.devicePixelRatio || 1) + 40) continue
    ctx.fillText(SECTION_TITLES[pi].toUpperCase(), w / 2, hy)
  }

  ctx.restore()
}

// ── Margin annotations ────────────────────────────────────────────────────────

const ANNOTATIONS = [
  "Iä! Iä!", "Ph'nglui mglw'nafh", "Cthulhu R'lyeh", "wgah'nagl fhtagn",
  "In his house at R'lyeh", "dead Cthulhu waits dreaming",
  "That is not dead which can eternal lie",
  "Iä! Iä! Cthulhu fhtagn!", "Ph'nglui",
]

export function drawMarginAnnotations(ctx, w, h, visibleItems, sanity, time, scrollTop) {
  if (sanity < 0.28) return
  const t = Math.min(1, (sanity - 0.28) / 0.55)
  ctx.save()
  ctx.font = '11px "IM Fell English"'
  ctx.textBaseline = 'alphabetic'

  for (let i = 0; i < visibleItems.length; i += 9) {
    const item = visibleItems[i]
    const screenY = item.y - scrollTop + Math.sin(time * 0.3 + i * 0.8) * 3 * t
    if (screenY < -20 || screenY > h + 20) continue

    const ann = ANNOTATIONS[(item.lineIndex * 7 + i) % ANNOTATIONS.length]
    const wobble = Math.sin(time * 0.5 + item.lineIndex * 0.4) * t * 4
    const alpha = t * 0.55

    // Left margin annotation
    if (item.lineIndex % 18 < 9) {
      ctx.textAlign = 'right'
      ctx.fillStyle = `rgba(160, 60, 20, ${alpha})`
      ctx.fillText(ann, MARGIN_H - 8 + wobble, screenY)
    } else {
      // Right margin
      ctx.textAlign = 'left'
      ctx.fillStyle = `rgba(140, 50, 15, ${alpha})`
      ctx.fillText(ann, w - MARGIN_H + 8 + wobble, screenY)
    }
  }
  ctx.restore()
}
