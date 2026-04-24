import { useEffect, useRef, useState, useCallback } from 'react'
import { buildRenderItems, disposeLayout, FONT_SIZE, LINE_HEIGHT } from '../utils/layout.js'
import { getProximityTextColor, substituteByProximity } from '../utils/effects.js'
import { computeHeadlineMetrics, drawHeadline, clearCanvas, drawCursorAura, drawVignette, drawSectionHeading, drawMarginAnnotations } from '../utils/render.js'
import { createSpine, buildSpine, getCharEffect, INFLUENCE_RADIUS } from '../utils/tentacle.js'
import { initTentacleGL, renderTentacleGL } from '../utils/tentacleGL.js'

const FONT = `${FONT_SIZE}px "IM Fell English"`
const SCROLL_BUFFER = LINE_HEIGHT * 4

export default function ManuscriptCanvas() {
  const canvasRef    = useRef(null)
  const glCanvasRef  = useRef(null)
  const glStateRef   = useRef(null)
  const containerRef = useRef(null)
  const scrollRef    = useRef(null)

  const scrollTopRef = useRef(0)
  const timeRef      = useRef(0)
  const cssSizeRef   = useRef({ w: 0, h: 0 })
  const itemsRef     = useRef([])
  const charCacheRef = useRef(new Map())
  const mouseRef         = useRef({ x: -300, y: -300 })
  const prevMouseRef     = useRef({ x: -300, y: -300 })
  const smoothSpeedRef   = useRef(0)
  const writheRef        = useRef(0)
  const headlineMetrics  = useRef(null)
  const spineRef         = useRef(createSpine())

  const [totalHeight, setTotalHeight] = useState(10000)
  const [fontsReady, setFontsReady]   = useState(false)

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true))
  }, [])

  useEffect(() => {
    if (!fontsReady) return
    const glCanvas = glCanvasRef.current
    if (!glCanvas) return
    glStateRef.current = initTentacleGL(glCanvas)
    return () => { glStateRef.current = null }
  }, [fontsReady])

  const handleScroll = useCallback((e) => {
    scrollTopRef.current = e.currentTarget.scrollTop
  }, [])

  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -300, y: -300 }
  }, [])

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
      const glCanvas = glCanvasRef.current
      if (glCanvas) {
        glCanvas.width  = Math.round(w * dpr)
        glCanvas.height = Math.round(h * dpr)
      }

      // Compute headline metrics and use totalH as story text padding
      const ctx = canvas.getContext('2d')
      const metrics = computeHeadlineMetrics(ctx, w, h)
      headlineMetrics.current = metrics

      const { items, totalHeight: th } = buildRenderItems(w, metrics.totalH)
      itemsRef.current = items
      charCacheRef.current = new Map()
      setTotalHeight(th)
    })
    obs.observe(container)
    return () => { obs.disconnect(); disposeLayout() }
  }, [fontsReady])

  useEffect(() => {
    if (!fontsReady) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let lastT = performance.now(), rafId, running = true

    function loop(now) {
      if (!running) return
      const delta = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      timeRef.current += delta

      const { w, h } = cssSizeRef.current
      if (w === 0 || h === 0) { rafId = requestAnimationFrame(loop); return }

      const { x: mx, y: my } = mouseRef.current
      const time      = timeRef.current
      const scrollTop = scrollTopRef.current
      const items     = itemsRef.current
      const spine     = spineRef.current
      const dpr       = window.devicePixelRatio || 1
      const charCache = charCacheRef.current

      // Drive writhe intensity from cursor speed — double-smoothed to kill per-frame jitter
      const prev = prevMouseRef.current
      const onScreen = mx > -250
      if (onScreen && prev.x > -250) {
        const rawSpeed = Math.min(Math.hypot(mx - prev.x, my - prev.y) / Math.max(delta, 0.001), 480)
        smoothSpeedRef.current += (rawSpeed - smoothSpeedRef.current) * Math.min(1, delta * 2.5)
      } else {
        smoothSpeedRef.current *= Math.max(0, 1 - delta * 10)
      }
      const writheTarget = Math.min(1, smoothSpeedRef.current / 300)
      // Asymmetric: slow build, fast drop
      const blend = writheTarget > writheRef.current ? delta * 2 : delta * 10
      writheRef.current += (writheTarget - writheRef.current) * Math.min(1, blend)

      if (onScreen) { prev.x = mx; prev.y = my }
      else          { prev.x = -300; prev.y = -300 }

      // Build spine procedurally — tip at cursor, body extends lower-right (~45°, cursor-like)
      buildSpine(spine, mx, my, 0.707, 0.707, time, writheRef.current)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      clearCanvas(ctx, w, h)
      drawCursorAura(ctx, w, h, mx, my)
      drawHeadline(ctx, w, scrollTop, headlineMetrics.current)
      drawSectionHeading(ctx, w, scrollTop, items)

      const visibleItems = items.filter(
        it => (it.y - scrollTop) >= -SCROLL_BUFFER && (it.y - scrollTop) <= h + SCROLL_BUFFER
      )
      drawMarginAnnotations(ctx, w, h, visibleItems, time, scrollTop)

      // Text pass — per-char proximity effects
      ctx.font = FONT
      ctx.textBaseline = 'alphabetic'

      for (const item of visibleItems) {
        const screenY = item.y - scrollTop

        // Fast path: skip per-char work for lines far from the tentacle
        const lineMidX = item.x + item.width * 0.5
        let lineMinDist = Infinity
        for (const seg of spine) {
          const d = Math.hypot(lineMidX - seg.x, screenY - seg.y)
          if (d < lineMinDist) lineMinDist = d
        }
        if (lineMinDist > INFLUENCE_RADIUS + item.width * 0.6) {
          ctx.fillStyle = '#7ab888'
          ctx.fillText(item.text, item.x, screenY)
          continue
        }

        // Per-character rendering for lines near the tentacle
        let curX = item.x
        for (let i = 0; i < item.text.length; i++) {
          const ch = item.text[i]
          let charW = charCache.get(ch)
          if (charW === undefined) {
            charW = ctx.measureText(ch).width
            charCache.set(ch, charW)
          }

          const { proximity, dx, dy } = getCharEffect(curX + charW * 0.5, screenY, spine)
          const drawCh = substituteByProximity(ch, i, item.lineIndex, proximity, time)
          ctx.fillStyle = getProximityTextColor(proximity)
          ctx.fillText(drawCh, curX + dx, screenY + dy)
          curX += charW
        }
      }

      renderTentacleGL(glStateRef.current, spine, w, h, dpr)
      drawVignette(ctx, w, h)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    const onVis = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(rafId)
      } else {
        running = true
        lastT = performance.now()
        rafId = requestAnimationFrame(loop)
      }
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
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', cursor: 'none' }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <canvas
        ref={glCanvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
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
          background: '#060c06',
          color: '#7ab888',
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
