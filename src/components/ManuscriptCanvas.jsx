import { useEffect, useRef, useState, useCallback } from 'react'
import { buildRenderItems, disposeLayout, FONT_SIZE, LINE_HEIGHT } from '../utils/layout.js'
import { easeSanity, getBackgroundColor, getTextColor, applyInkBleed, resetBleed,
         getLineOscillation, drawGlyphDrift, substituteGlyphs, maybeReverseWords } from '../utils/effects.js'
import { clearCanvas, drawGrain, drawVignette, drawSectionHeading, drawMarginAnnotations } from '../utils/render.js'

const FONT = `${FONT_SIZE}px "IM Fell English"`
const SCROLL_BUFFER = LINE_HEIGHT * 4

export default function ManuscriptCanvas() {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)
  const scrollRef    = useRef(null)

  // RAF-loop state — all refs to avoid re-renders
  const sanityRef    = useRef(0)
  const rawScrollRef = useRef(0)
  const scrollTopRef = useRef(0)
  const timeRef      = useRef(0)
  const cssSizeRef   = useRef({ w: 0, h: 0 })
  const itemsRef     = useRef([])
  const charCacheRef = useRef(new Map())

  const [totalHeight, setTotalHeight] = useState(10000)
  const [fontsReady, setFontsReady]   = useState(false)

  // Gate layout behind font readiness
  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true))
  }, [])

  // Scroll handler — update sanity + scrollTop refs only (no re-render)
  const handleScroll = useCallback((e) => {
    const el = e.currentTarget
    const maxScroll = el.scrollHeight - el.clientHeight
    rawScrollRef.current = maxScroll > 0 ? el.scrollTop / maxScroll : 0
    scrollTopRef.current = el.scrollTop
  }, [])

  // ResizeObserver — rebuild layout + resize canvas
  useEffect(() => {
    if (!fontsReady) return
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return

    const obs = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect
      cssSizeRef.current = { w, h }
      const dpr = window.devicePixelRatio || 1
      canvas.width  = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)

      const { items, totalHeight: th } = buildRenderItems(w)
      itemsRef.current = items
      charCacheRef.current = new Map() // reset char cache on resize
      setTotalHeight(th)
    })
    obs.observe(container)
    return () => { obs.disconnect(); disposeLayout() }
  }, [fontsReady])

  // RAF loop
  useEffect(() => {
    if (!fontsReady) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let lastT = performance.now(), rafId

    function loop(now) {
      const delta = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      timeRef.current += delta

      const { w, h } = cssSizeRef.current
      if (w === 0 || h === 0) { rafId = requestAnimationFrame(loop); return }

      const rawSanity = rawScrollRef.current
      const sanity    = easeSanity(rawSanity)
      sanityRef.current = sanity

      const scrollTop = scrollTopRef.current
      const time      = timeRef.current
      const items     = itemsRef.current
      const dpr       = window.devicePixelRatio || 1
      const charCache = charCacheRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Background + grain
      const bgColor = getBackgroundColor(sanity)
      clearCanvas(ctx, w, h, sanity, bgColor)
      drawGrain(ctx, w, h, sanity)

      // Section headings (faint, behind text)
      drawSectionHeading(ctx, w, scrollTop, items, sanity)

      // Margin annotations
      const visibleItems = items.filter(
        it => (it.y - scrollTop) >= -SCROLL_BUFFER && (it.y - scrollTop) <= h + SCROLL_BUFFER
      )
      drawMarginAnnotations(ctx, w, h, visibleItems, sanity, time, scrollTop)

      // Text pass
      ctx.font         = FONT
      ctx.textBaseline = 'alphabetic'
      applyInkBleed(ctx, sanity)

      for (const item of visibleItems) {
        const screenY = item.y - scrollTop + getLineOscillation(item.lineIndex, sanity, time)
        const text    = substituteGlyphs(
          maybeReverseWords(item.text, sanity, item.lineIndex),
          sanity, time, item.lineIndex
        )
        ctx.fillStyle = getTextColor(sanity)
        drawGlyphDrift(ctx, item.x, screenY, text, sanity, time, item.lineIndex, charCache)
      }

      resetBleed(ctx)

      // Vignette (always on top)
      drawVignette(ctx, w, h, sanity)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(rafId)
      else rafId = requestAnimationFrame(loop)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fontsReady])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {/* Invisible div that captures scroll and creates scroll travel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          position: 'absolute', inset: 0,
          overflowY: 'scroll',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ height: totalHeight, width: 1, pointerEvents: 'none' }} />
      </div>

      {!fontsReady && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1a1208',
          color: '#c8a882',
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: '1.1rem',
          letterSpacing: '0.12em',
          animation: 'flicker 2s ease-in-out infinite',
        }}>
          Reading the stars…
        </div>
      )}
    </div>
  )
}
