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
  const freq = 0.9 + writheIntensity * 0.9
  for (let i = 0; i < SPINE_N; i++) {
    const t = i / (SPINE_N - 1)
    const along = t * TENTACLE_LENGTH
    const amp = (0.1 + 0.9 * Math.min(1, t * 2.5)) * (2 + 46 * writheIntensity)
    const wave = Math.sin(time * 1.7 * freq + t * 3.8)        * amp
               + Math.sin(time * 2.8 * freq - t * 2.2 + 1.1) * amp * 0.38
    spine[i].x = mx + cos * along + px * wave
    spine[i].y = my + sin * along + py * wave
  }
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
