const SPINE_N = 16
const TENTACLE_LENGTH = 260
export const INFLUENCE_RADIUS = 160
export const GAP_RADIUS = 58

export function createSpine() {
  return Array.from({ length: SPINE_N }, () => ({ x: -300, y: -300 }))
}

// Build spine procedurally each frame — no physics, no degenerate states
// cos, sin: unit vector pointing from tip (cursor) toward base
// writheIntensity: 0 = barely moving, 1 = full thrash (driven by cursor speed)
export function buildSpine(spine, mx, my, cos, sin, time, writheIntensity = 0) {
  const px = -sin, py = cos
  // Both amplitude and frequency scale with speed
  const freq = 0.9 + writheIntensity * 0.8
  for (let i = 0; i < SPINE_N; i++) {
    const t = i / (SPINE_N - 1)
    const along = t * TENTACLE_LENGTH
    const amp = (0.1 + 0.9 * Math.min(1, t * 2.5)) * (2 + 36 * writheIntensity)
    const wave = Math.sin(time * 1.7 * freq + t * 3.8)        * amp
               + Math.sin(time * 2.8 * freq - t * 2.2 + 1.1) * amp * 0.38
    spine[i].x = mx + cos * along + px * wave
    spine[i].y = my + sin * along + py * wave
  }
}

function buildEdges(spine) {
  const n = spine.length
  const left = [], right = []
  for (let i = 0; i < n; i++) {
    const hw = 1.5 + (i / (n - 1)) * 13
    let ddx, ddy
    if (i === 0)        { ddx = spine[0].x - spine[1].x;         ddy = spine[0].y - spine[1].y }
    else if (i === n-1) { ddx = spine[n-2].x - spine[n-1].x;     ddy = spine[n-2].y - spine[n-1].y }
    else                { ddx = spine[i-1].x - spine[i+1].x;     ddy = spine[i-1].y - spine[i+1].y }
    const len = Math.hypot(ddx, ddy) || 1
    const nx = -ddy / len, ny = ddx / len
    left.push({ x: spine[i].x + nx * hw, y: spine[i].y + ny * hw })
    right.push({ x: spine[i].x - nx * hw, y: spine[i].y - ny * hw })
  }
  return { left, right }
}

export function drawTentacle(ctx, spine) {
  if (spine[0].x < -250) return
  const n = spine.length
  ctx.save()

  const { left, right } = buildEdges(spine)

  // Glow
  ctx.shadowColor = '#1a5c1e'
  ctx.shadowBlur = 26

  // Body: pointed tip → left edge → flat base → right edge back → close
  ctx.beginPath()
  ctx.moveTo(spine[0].x, spine[0].y)
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y)
  ctx.lineTo(right[n - 1].x, right[n - 1].y)
  for (let i = n - 2; i >= 1; i--) ctx.lineTo(right[i].x, right[i].y)
  ctx.closePath()
  ctx.fillStyle = '#0c2e0f'
  ctx.fill()
  ctx.shadowBlur = 0

  // Highlight ridge down the left face
  ctx.beginPath()
  ctx.moveTo(spine[0].x, spine[0].y)
  for (let i = 1; i < n; i++) {
    ctx.lineTo(
      (left[i].x + spine[i].x) / 2,
      (left[i].y + spine[i].y) / 2
    )
  }
  ctx.strokeStyle = 'rgba(70, 150, 75, 0.22)'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.stroke()

  // Suckers (3 rings, increasing size toward base)
  const suckerIndices = [
    Math.floor(n * 0.35),
    Math.floor(n * 0.55),
    Math.floor(n * 0.75),
  ]
  for (const si of suckerIndices) {
    const r = (1.5 + (si / (n - 1)) * 13) * 0.52
    ctx.beginPath()
    ctx.arc(spine[si].x, spine[si].y, r, 0, Math.PI * 2)
    ctx.fillStyle = '#071509'
    ctx.fill()
    ctx.strokeStyle = 'rgba(55, 110, 60, 0.6)'
    ctx.lineWidth = 0.9
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(spine[si].x, spine[si].y, r * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(20, 55, 22, 0.85)'
    ctx.fill()
  }

  // Tip glow
  ctx.shadowColor = '#70ff78'
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.arc(spine[0].x, spine[0].y, 2.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(115, 240, 120, 0.8)'
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.restore()
}

export function getCharEffect(charX, charY, spine) {
  let minDist = Infinity
  let nearX = spine[0].x, nearY = spine[0].y
  for (const seg of spine) {
    const d = Math.hypot(charX - seg.x, charY - seg.y)
    if (d < minDist) { minDist = d; nearX = seg.x; nearY = seg.y }
  }

  const proximity = Math.max(0, 1 - minDist / INFLUENCE_RADIUS)

  let dx = 0, dy = 0
  if (minDist < GAP_RADIUS && minDist > 0.5) {
    const t = 1 - minDist / GAP_RADIUS
    const angle = Math.atan2(charY - nearY, charX - nearX)
    const strength = t * t * 18
    dx = Math.cos(angle) * strength
    dy = Math.sin(angle) * strength
  }

  return { proximity, dx, dy }
}
