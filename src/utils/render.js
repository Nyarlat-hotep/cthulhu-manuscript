import { MARGIN_H } from './layout.js'

const HEADLINE_WORDS = ['The', 'Call', 'of', 'Cthulhu']

// Compute headline layout metrics — call this in the resize handler
export function computeHeadlineMetrics(ctx, w, h) {
  const padX = 60
  const REF = 100
  ctx.font = `bold ${REF}px "UnifrakturCook"`
  const longestW = ctx.measureText('Cthulhu').width
  const fontFromWidth  = Math.floor(REF * (w - padX * 2) / longestW)
  const fontFromHeight = Math.floor(h / (HEADLINE_WORDS.length * 1.25))
  const fontSize = Math.min(fontFromWidth, fontFromHeight)
  const lineH = fontSize * 1.18
  const blockH = lineH * HEADLINE_WORDS.length
  const totalH = Math.ceil(blockH + h * 0.12)  // headline area + breathing room before story
  return { fontSize, lineH, blockH, totalH, padX }
}

// Draw headline scrolling with document content
export function drawHeadline(ctx, w, scrollTop, metrics) {
  if (!metrics || metrics.fontSize <= 0) return
  const { fontSize, lineH, blockH, totalH, padX } = metrics

  // Vertically center the text block within its totalH area
  const startY = (totalH - blockH) / 2 - scrollTop
  if (startY + blockH < -20) return  // scrolled fully off screen

  ctx.save()
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.font = `bold ${fontSize}px "UnifrakturCook"`
  ctx.fillStyle = 'rgba(105, 200, 120, 0.88)'

  for (let i = 0; i < HEADLINE_WORDS.length; i++) {
    ctx.fillText(HEADLINE_WORDS[i], padX, startY + i * lineH)
  }
  ctx.restore()
}

export function clearCanvas(ctx, w, h) {
  ctx.fillStyle = '#060c06'
  ctx.fillRect(0, 0, w, h)
}

// Radial darkening centered on tentacle tip (cursor)
export function drawCursorAura(ctx, w, h, mx, my) {
  if (mx < -250) return
  const grad = ctx.createRadialGradient(mx, my, 18, mx, my, 210)
  grad.addColorStop(0, 'rgba(2, 8, 3, 0.90)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

export function drawVignette(ctx, w, h) {
  const cx = w / 2, cy = h / 2
  const r0 = Math.min(w, h) * 0.15
  const r1 = Math.sqrt(cx * cx + cy * cy) * 1.1
  const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.52)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

const SECTION_TITLES = [
  'I. The Horror in Clay',
  'II. The Tale of Inspector Legrasse',
  'III. The Madness from the Sea',
]

export function drawSectionHeading(ctx, w, scrollTop, items) {
  if (items.length === 0) return
  ctx.save()
  ctx.font = 'bold 32px "UnifrakturCook"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(105, 200, 120, 0.55)'

  const partStarts = [null, null, null]
  for (const item of items) {
    if (partStarts[item.partIndex] === null) partStarts[item.partIndex] = item.y
  }
  for (let pi = 0; pi < 3; pi++) {
    if (partStarts[pi] === null) continue
    const hy = partStarts[pi] - 44 - scrollTop
    if (hy < -60 || hy > ctx.canvas.height / (window.devicePixelRatio || 1) + 60) continue
    ctx.fillText(SECTION_TITLES[pi], w / 2, hy)
  }
  ctx.restore()
}

const ANNOTATIONS = [
  "Iä! Iä!", "Ph'nglui mglw'nafh", "Cthulhu R'lyeh", "wgah'nagl fhtagn",
  "In his house at R'lyeh", "dead Cthulhu waits dreaming",
  "That is not dead which can eternal lie",
  "Iä! Iä! Cthulhu fhtagn!", "Ph'nglui",
]

export function drawMarginAnnotations(ctx, w, h, visibleItems, time, scrollTop) {
  ctx.save()
  ctx.font = '11px "IM Fell English"'
  ctx.textBaseline = 'alphabetic'

  for (let i = 0; i < visibleItems.length; i += 9) {
    const item = visibleItems[i]
    const screenY = item.y - scrollTop + Math.sin(time * 0.3 + i * 0.8) * 3
    if (screenY < -20 || screenY > h + 20) continue

    const ann = ANNOTATIONS[(item.lineIndex * 7 + i) % ANNOTATIONS.length]
    const wobble = Math.sin(time * 0.5 + item.lineIndex * 0.4) * 4

    if (item.lineIndex % 18 < 9) {
      ctx.textAlign = 'right'
      ctx.fillStyle = `rgba(50, 140, 65, 0.22)`
      ctx.fillText(ann, MARGIN_H - 8 + wobble, screenY)
    } else {
      ctx.textAlign = 'left'
      ctx.fillStyle = `rgba(40, 120, 55, 0.22)`
      ctx.fillText(ann, w - MARGIN_H + 8 + wobble, screenY)
    }
  }
  ctx.restore()
}
