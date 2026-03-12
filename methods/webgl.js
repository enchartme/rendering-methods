// ════════════════════════════════════════════════════════════════════════
// SHADERS
// ════════════════════════════════════════════════════════════════════════

// Each dot is a GL_POINT.
// The vertex shader converts data-space [0,1] → clip space [-1,1],
// taking margins into account via uniforms.
const VS_SOURCE = `
  attribute vec2  a_pos;    // data-space position [0,1]
  attribute float a_size;   // radius in physical (framebuffer) pixels
  attribute float a_hover;  // 0 = normal, 1 = hovered

  uniform vec2 u_res;       // canvas size in CSS pixels (width, height)
  uniform vec4 u_margin;    // CSS pixels: left, top, right, bottom

  varying float v_hover;

  void main() {
    // data [0,1] -> CSS pixel position inside the plot area
    float plotW = u_res.x - u_margin.x - u_margin.z;
    float plotH = u_res.y - u_margin.y - u_margin.w;

    float px = u_margin.x + a_pos.x * plotW;
    float py = u_margin.y + (1.0 - a_pos.y) * plotH;   // y flipped

    // CSS pixels -> clip space [-1, 1]
    // clip x = px/resX * 2 - 1
    // clip y = 1 - py/resY * 2  (WebGL y-up, CSS y-down)
    float cx =  px / u_res.x * 2.0 - 1.0;
    float cy =  1.0 - py / u_res.y * 2.0;

    gl_Position  = vec4(cx, cy, 0.0, 1.0);
    gl_PointSize = a_size * 2.0;   // a_size is physical-px radius; PointSize is diameter
    v_hover      = a_hover;
  }
`;

// Each fragment of a GL_POINT gets a gl_PointCoord in [0,1]x[0,1].
// We use it to discard corners (making circles) and to apply a soft
// anti-aliased edge via smoothstep.
const FS_SOURCE = `
  precision mediump float;

  varying float v_hover;

  void main() {
    // gl_PointCoord goes [0,1] across the point sprite square.
    // Remap so that the centre is (0,0) and the radius is 0.5.
    vec2  coord = gl_PointCoord - vec2(0.5);
    float d     = length(coord);

    // Discard fragments outside the circle; soft anti-aliased edge
    float alpha = 1.0 - smoothstep(0.46, 0.5, d);
    if (alpha < 0.001) discard;

    // otter shine gold (70% opacity) ↔ otter think bright (100% opacity)
    vec3  blue  = vec3(0.957, 0.745, 0.000);
    vec3  pink  = vec3(0.898, 1.000, 1.000);
    vec3  color = mix(blue, pink, v_hover);
    float baseA = mix(0.9, 1.0, v_hover);

    // Stroke ring: otter sleep night near the circle edge
    vec3  stroke = vec3(0.039, 0.000, 0.196);  // #0a0032
    color = mix(color, stroke, smoothstep(0.38, 0.44, d));

    gl_FragColor = vec4(color, baseA * alpha);
  }
`;

// ════════════════════════════════════════════════════════════════════════
// WEBGL INIT
// ════════════════════════════════════════════════════════════════════════

const glCanvas = document.getElementById('gl-canvas');
const gl = glCanvas.getContext('webgl', {
  alpha: true,              // transparent so axis canvas shows through
  antialias: true,
  premultipliedAlpha: false // keep rgba math intuitive
});

if (!gl) { document.body.textContent = 'WebGL not supported.'; throw new Error(); }

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error('Shader compile error: ' + gl.getShaderInfoLog(s));
  return s;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER,   VS_SOURCE));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, FS_SOURCE));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS))
  throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
gl.useProgram(program);

// Attribute / uniform locations
const a_pos    = gl.getAttribLocation(program, 'a_pos');
const a_size   = gl.getAttribLocation(program, 'a_size');
const a_hover  = gl.getAttribLocation(program, 'a_hover');
const u_res    = gl.getUniformLocation(program, 'u_res');
const u_margin = gl.getUniformLocation(program, 'u_margin');

// GPU buffers (recreated when particle count changes)
let posBuffer   = gl.createBuffer();
let sizeBuffer  = gl.createBuffer();
let hoverBuffer = gl.createBuffer();

// CPU-side typed arrays (reallocated when particle count changes)
let posArr, sizeArr, hoverArr;

function allocArrays(count) {
  posArr   = new Float32Array(count * 2);
  sizeArr  = new Float32Array(count);
  hoverArr = new Float32Array(count);
}

// Enable blending so the transparent dots composite correctly
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(0, 0, 0, 0);   // fully transparent clear

// ════════════════════════════════════════════════════════════════════════
// AXIS CANVAS (2D — draws grid lines and text labels)
// Rendered beneath the WebGL canvas; pointer-events: none
// ════════════════════════════════════════════════════════════════════════

const axCanvas = document.getElementById('axis-canvas');
const ax = axCanvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;

const margin = { top: 20, right: 20, bottom: 50, left: 55 };
let cssW, cssH, plotW, plotH;

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

function drawAxes() {
  ax.clearRect(0, 0, cssW, cssH);

  const xPxAx = v => margin.left + v * plotW;
  const yPxAx = v => margin.top  + (1 - v) * plotH;

  // Grid lines
  ax.strokeStyle = '#2c2c52';
  ax.lineWidth   = 1;
  for (const v of TICKS) {
    ax.beginPath();
    ax.moveTo(xPxAx(v), margin.top);
    ax.lineTo(xPxAx(v), margin.top + plotH);
    ax.stroke();

    ax.beginPath();
    ax.moveTo(margin.left,         yPxAx(v));
    ax.lineTo(margin.left + plotW, yPxAx(v));
    ax.stroke();
  }

  // Tick labels
  ax.fillStyle    = '#b8b8d8';
  ax.font         = '11px sans-serif';
  ax.textAlign    = 'center';
  ax.textBaseline = 'top';
  for (const v of TICKS) ax.fillText(v.toFixed(1), xPxAx(v), margin.top + plotH + 6);

  ax.textAlign    = 'right';
  ax.textBaseline = 'middle';
  for (const v of TICKS) ax.fillText(v.toFixed(1), margin.left - 7, yPxAx(v));

  // Axis labels
  ax.fillStyle    = '#b8b8d8';
  ax.font         = '12px sans-serif';
  ax.textAlign    = 'center';
  ax.textBaseline = 'bottom';
  ax.fillText('X', margin.left + plotW / 2, cssH - 4);

  ax.save();
  ax.translate(13, margin.top + plotH / 2);
  ax.rotate(-Math.PI / 2);
  ax.textBaseline = 'bottom';
  ax.fillText('Y', 0, 0);
  ax.restore();
}

// ════════════════════════════════════════════════════════════════════════
// PARTICLE MODEL
// Each particle stores data-space (dx,dy) coords and from/to for animation.
// ════════════════════════════════════════════════════════════════════════

let particles = [];

const ANIM_MS  = 600;

let animT     = 1;     // normalised 0→1; 1 = idle
let animStart = 0;
let rafId     = null;

// Easing
function cubicInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - (-2*t+2)**3/2; }
function lerp(a, b, t) { return a + (b-a)*t; }

// ── Hover ─────────────────────────────────────────────────────────────────
let mouseX    = -Infinity, mouseY = -Infinity;
let hoveredIdx = -1;
const HOVER_PX = 20;

// ── Compute current position and size of a particle ───────────────────────
function getRendered(p) {
  const tPos = cubicInOut(Math.min(1, animT));
  const dx = lerp(p.fromDX, p.toDX, tPos);
  const dy = lerp(p.fromDY, p.toDY, tPos);
  // Pixel position (CSS pixels) for hover detection
  const px = margin.left + dx * plotW;
  const py = margin.top  + (1 - dy) * plotH;

  return { dx, dy, px, py, r: 5 };
}

// ════════════════════════════════════════════════════════════════════════
// GPU UPLOAD + DRAW
// ════════════════════════════════════════════════════════════════════════

function uploadAndDraw() {
  const count = particles.length;

  // Compute current rendered state, find hovered nearest neighbour
  let minDist2 = HOVER_PX * HOVER_PX;
  hoveredIdx = -1;

  for (let i = 0; i < count; i++) {
    const { dx, dy, px, py, r } = getRendered(particles[i]);
    posArr[i*2]   = dx;
    posArr[i*2+1] = dy;
    sizeArr[i]    = r * dpr;  // gl_PointSize is physical px, not CSS px

    const d2 = (px - mouseX)**2 + (py - mouseY)**2;
    if (d2 < minDist2) { minDist2 = d2; hoveredIdx = i; }
  }

  for (let i = 0; i < count; i++) {
    hoverArr[i] = i === hoveredIdx ? 1.0 : 0.0;
  }

  // Set uniforms
  gl.uniform2f(u_res,    cssW,    cssH);
  gl.uniform4f(u_margin, margin.left, margin.top, margin.right, margin.bottom);

  // Upload position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(a_pos);
  gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

  // Upload size buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sizeArr, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(a_size);
  gl.vertexAttribPointer(a_size, 1, gl.FLOAT, false, 0, 0);

  // Upload hover buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, hoverBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, hoverArr, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(a_hover);
  gl.vertexAttribPointer(a_hover, 1, gl.FLOAT, false, 0, 0);

  // Draw
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.POINTS, 0, count);
}

// ════════════════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ════════════════════════════════════════════════════════════════════════

function tick(ts) {
  animT = (ts - animStart) / ANIM_MS;

  if (animT < 1) {
    uploadAndDraw();
    rafId = requestAnimationFrame(tick);
  } else {
    animT = 1;
    // Settle: snap all particles to final positions
    for (const p of particles) {
      p.fromDX = p.toDX;
      p.fromDY = p.toDY;
      p.phase  = 'active';
    }
    uploadAndDraw();
    rafId = null;
  }
}

function startAnim() {
  if (rafId) cancelAnimationFrame(rafId);
  animStart = performance.now();
  animT = 0;
  rafId = requestAnimationFrame(tick);
}

// ════════════════════════════════════════════════════════════════════════
// TRANSITION  (same enter/update/exit logic as canvas.js)
// ════════════════════════════════════════════════════════════════════════

function transition(newData) {
  // Snap mid-animation positions to current interpolated values
  if (animT < 1) {
    const tPos = cubicInOut(animT);
    for (const p of particles) {
      p.fromDX = lerp(p.fromDX, p.toDX, tPos);
      p.fromDY = lerp(p.fromDY, p.toDY, tPos);
    }
  }

  const keep = Math.min(particles.length, newData.length);
  const next  = [];

  // Update — animate existing dots to new positions
  for (let i = 0; i < keep; i++) {
    next.push({
      phase: 'active',
      fromDX: particles[i].fromDX, fromDY: particles[i].fromDY,
      toDX:   newData[i].x,        toDY:   newData[i].y,
    });
  }

  // Enter — place new dots at their target position immediately
  for (let i = keep; i < newData.length; i++) {
    next.push({
      phase: 'active',
      fromDX: newData[i].x, fromDY: newData[i].y,
      toDX:   newData[i].x, toDY:   newData[i].y,
    });
  }
  // Exit — removed dots are dropped immediately

  particles = next;
  allocArrays(particles.length);
  startAnim();
}

// ════════════════════════════════════════════════════════════════════════
// RESIZE — reads container size, resizes both canvases, reprojects
// ════════════════════════════════════════════════════════════════════════

function resize() {
  cssW  = glCanvas.clientWidth;
  cssH  = glCanvas.clientHeight;
  plotW = cssW - margin.left - margin.right;
  plotH = cssH - margin.top  - margin.bottom;

  // WebGL canvas backing buffer
  glCanvas.width  = cssW * dpr;
  glCanvas.height = cssH * dpr;
  gl.viewport(0, 0, glCanvas.width, glCanvas.height);

  // Axis (2D) canvas backing buffer
  axCanvas.width  = cssW * dpr;
  axCanvas.height = cssH * dpr;
  ax.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawAxes();

  // Reproject live particles (no animation needed, just snap)
  if (particles.length && rafId) {
    cancelAnimationFrame(rafId);
    rafId  = null;
    animT  = 1;
    for (const p of particles) {
      p.fromDX = p.toDX;
      p.fromDY = p.toDY;
      p.phase  = 'active';
    }
  }

  if (particles.length) uploadAndDraw();
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 40);
});

// ════════════════════════════════════════════════════════════════════════
// MOUSE EVENTS — nearest-neighbour hover (CPU-side)
// ════════════════════════════════════════════════════════════════════════

glCanvas.addEventListener('mousemove', e => {
  const rect = glCanvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  if (!rafId) uploadAndDraw();   // repaint hover when idle
});

glCanvas.addEventListener('mouseleave', () => {
  mouseX = -Infinity; mouseY = -Infinity; hoveredIdx = -1;
  if (!rafId) uploadAndDraw();
});

const initData = generateNormal(1000);
particles = initData.map(d => ({
  phase: 'active',
  fromDX: d.x, fromDY: d.y,
  toDX:   d.x, toDY:   d.y,
}));
allocArrays(particles.length);
resize();    // sets cssW/H, sizes canvases, draws axes, draws dots
initControls({ onRender: transition });
