const VERT_SRC = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG_SRC = `#version 300 es
precision highp float;

uniform vec2  u_css;
uniform float u_dpr;
uniform vec2  u_spine[16];

out vec4 fragColor;

float closestOnSeg(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 ab = b - a;
  float len2 = dot(ab, ab);
  if (len2 < 1e-6) { t = 0.0; return length(p - a); }
  t = clamp(dot(p - a, ab) / len2, 0.0, 1.0);
  return length(p - (a + ab * t));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x / u_dpr, u_css.y - gl_FragCoord.y / u_dpr);

  if (u_spine[0].x < -250.0) { discard; }

  float minD  = 1e9;
  float bestT = 0.0;

  for (int i = 0; i < 15; i++) {
    float st;
    float d = closestOnSeg(p, u_spine[i], u_spine[i + 1], st);
    if (d < minD) {
      minD  = d;
      bestT = (float(i) + st) / 15.0;
    }
  }

  float radius = mix(1.8, 14.5, bestT);
  float tipD   = length(p - u_spine[0]);

  if (minD > radius + 44.0 && tipD > 22.0) { discard; }

  // Outer glow band
  if (minD > radius) {
    float g = exp(-(minD - radius) * 0.065) * 0.55;
    if (g < 0.005) discard;
    fragColor = vec4(0.07 * g, 0.38 * g, 0.09 * g, g);
    return;
  }

  // Body — cylindrical shading ──────────────────────────────
  float profile = minD / radius;
  float nz      = sqrt(max(0.0, 1.0 - profile * profile));

  float diffuse = nz * 0.78 + 0.22;
  float spec    = pow(nz, 18.0) * 0.65;

  vec3 shadow = vec3(0.016, 0.060, 0.018);
  vec3 body   = vec3(0.038, 0.155, 0.044);
  vec3 bright = vec3(0.26,  0.70,  0.28);

  vec3 col = mix(shadow, body, diffuse) + bright * spec;

  // Suckers at spine indices 5, 8, 11
  for (int si = 0; si < 3; si++) {
    int   idx = si * 3 + 5;
    vec2  sc  = u_spine[idx];
    float sr  = mix(1.8, 14.5, float(idx) / 15.0) * 0.56;
    float sd  = length(p - sc);
    if (sd < sr) {
      float sp = sd / sr;
      // Concave bowl — dark center
      float bowl = (1.0 - sp) * (1.0 - sp);
      col = mix(col, vec3(0.005, 0.018, 0.006), bowl * 0.92);
      // Bright wet rim
      col += vec3(0.16, 0.52, 0.18) * smoothstep(0.72, 1.0, sp) * 0.70;
      // Inner highlight sparkle
      col += vec3(0.55, 0.95, 0.57) * smoothstep(0.90, 1.0, sp) * 0.25;
    }
  }

  // Soft silhouette edge
  float alpha = smoothstep(1.0, 0.68, profile);

  // Bioluminescent tip glow
  if (tipD < 17.0) {
    float tg = 1.0 - tipD / 17.0;
    tg    = tg * tg;
    col  += vec3(0.22, 0.94, 0.26) * tg * 1.3;
    alpha = max(alpha, tg * 0.95);
  }

  // Premultiplied alpha output
  fragColor = vec4(col * alpha, alpha);
}
`

function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[tentacleGL] shader error:', gl.getShaderInfoLog(s))
    return null
  }
  return s
}

export function initTentacleGL(canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true })
  if (!gl) { console.warn('[tentacleGL] WebGL2 unavailable'); return null }

  const vs = compile(gl, gl.VERTEX_SHADER,   VERT_SRC)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  if (!vs || !fs) return null

  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[tentacleGL] link error:', gl.getProgramInfoLog(prog))
    return null
  }

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,   1, -1,  -1,  1,
     1, -1,   1,  1,  -1,  1,
  ]), gl.STATIC_DRAW)

  const posLoc = gl.getAttribLocation(prog, 'a_pos')
  const uCss   = gl.getUniformLocation(prog, 'u_css')
  const uDpr   = gl.getUniformLocation(prog, 'u_dpr')
  const uSpine = gl.getUniformLocation(prog, 'u_spine')

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  const spineFlat = new Float32Array(32)

  return { gl, prog, buf, posLoc, uCss, uDpr, uSpine, spineFlat }
}

export function renderTentacleGL(state, spine, cssW, cssH, dpr) {
  if (!state) return
  const { gl, prog, buf, posLoc, uCss, uDpr, uSpine, spineFlat } = state

  gl.viewport(0, 0, Math.round(cssW * dpr), Math.round(cssH * dpr))
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  if (spine[0].x < -250) return

  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

  gl.uniform2f(uCss, cssW, cssH)
  gl.uniform1f(uDpr, dpr)

  for (let i = 0; i < 16; i++) {
    spineFlat[i * 2]     = spine[i].x
    spineFlat[i * 2 + 1] = spine[i].y
  }
  gl.uniform2fv(uSpine, spineFlat)

  gl.drawArrays(gl.TRIANGLES, 0, 6)
}
