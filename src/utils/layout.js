import { prepareWithSegments, layoutWithLines, clearCache } from '@chenglou/pretext'
import { ALL_PARTS, PART_OFFSETS } from '../data/text.js'

const FONT_SIZE = 18
const LINE_HEIGHT = 30
const PARAGRAPH_GAP = 22
const MARGIN_H = 72   // left & right margin in CSS px
const PADDING_TOP = 80
const PADDING_BOTTOM = 120

export { FONT_SIZE, LINE_HEIGHT, MARGIN_H, PADDING_TOP }

// Paragraphs prepared once — module-level cache
let _prepared = null

function ensurePrepared() {
  if (_prepared) return
  _prepared = ALL_PARTS.map(p =>
    prepareWithSegments(p, `${FONT_SIZE}px "IM Fell English"`)
  )
}

/**
 * Build the flat array of render items for a given canvas CSS width.
 * Must be called after fonts are loaded (document.fonts.ready).
 *
 * @param {number} canvasWidth  CSS pixels (not DPR-scaled)
 * @returns {{ items: RenderItem[], totalHeight: number }}
 *
 * RenderItem = { text: string, x: number, y: number, lineIndex: number, partIndex: 0|1|2 }
 */
export function buildRenderItems(canvasWidth) {
  ensurePrepared()
  const contentWidth = Math.max(200, canvasWidth - MARGIN_H * 2)
  const items = []
  let y = PADDING_TOP

  for (let pi = 0; pi < _prepared.length; pi++) {
    const partIndex =
      pi < PART_OFFSETS[1] ? 0 :
      pi < PART_OFFSETS[2] ? 1 : 2

    const { lines } = layoutWithLines(_prepared[pi], contentWidth, LINE_HEIGHT)

    for (const line of lines) {
      items.push({
        text: line.text,
        width: line.width,
        x: MARGIN_H,
        y,
        lineIndex: items.length,
        partIndex,
      })
      y += LINE_HEIGHT
    }
    y += PARAGRAPH_GAP
  }

  return { items, totalHeight: y + PADDING_BOTTOM }
}

export function disposeLayout() {
  clearCache()
  _prepared = null
}
