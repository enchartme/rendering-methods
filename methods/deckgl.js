// ════════════════════════════════════════════════════════════════════════
// AXIS CANVAS (2-D — draws grid lines and tick labels)
// Rendered beneath the deck.gl canvas; pointer-events: none
// ════════════════════════════════════════════════════════════════════════

const axCanvas   = document.getElementById('axis-canvas');
const ax          = axCanvas.getContext('2d');
const dpr         = window.devicePixelRatio || 1;
const chartDiv    = document.querySelector('.chart-container');

// Create the deck.gl canvas explicitly so we control its sizing
const deckCanvas  = document.createElement('canvas');
deckCanvas.id     = 'deck-canvas';
chartDiv.appendChild(deckCanvas);

const margin = { top: 20, right: 20, bottom: 50, left: 55 };
let cssW, cssH, plotW, plotH;

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

function drawAxes() {
  // Resize axis canvas backing buffer to match physical pixels
  axCanvas.width  = cssW * dpr;
  axCanvas.height = cssH * dpr;
  ax.scale(dpr, dpr);

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
  ax.font         = `11px sans-serif`;
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
// Each particle: { id, dx, dy, targetR }
// deck.gl handles GPU-side attribute interpolation (position + radius).
// ════════════════════════════════════════════════════════════════════════

let particles  = [];  // current data array passed to deck.gl
let nextId     = 0;
let hoveredId  = null;

// Converters: data-space [0,1] → CSS pixel world coords for deck.gl CARTESIAN
// deck.gl OrthographicView (flipY:true default) matches CSS: y increases downward.
function dataToWorld(dx, dy) {
  return [
    margin.left + dx * plotW,
    margin.top  + (1 - dy) * plotH
  ];
}

// ════════════════════════════════════════════════════════════════════════
// ANIMATION CONSTANTS (easing callbacks for deck.gl transitions)
// ════════════════════════════════════════════════════════════════════════

const ANIM_MS  = 600;

function cubicInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - (-2*t+2)**3/2; }

// ════════════════════════════════════════════════════════════════════════
// DECK.GL SETUP
// ════════════════════════════════════════════════════════════════════════

const { Deck, OrthographicView, ScatterplotLayer, COORDINATE_SYSTEM } = deck;

function buildLayer() {
  return new ScatterplotLayer({
    id: 'scatter',
    data: particles,

    // Position: convert data-space → CSS pixels (deck.gl CARTESIAN world space)
    getPosition: d => dataToWorld(d.dx, d.dy),

    // Radius in CSS pixels
    getRadius: d => d.targetR,
    radiusUnits: 'pixels',

    // otter swim blue (70% opacity) or otter play pink on hover
    getFillColor: d => d.id === hoveredId
      ? [230, 120, 233, 255]
      : [244, 190, 0, 178],

    stroked: true,
    getLineColor: [10, 0, 50, 255],   // otter sleep night
    lineWidthMinPixels: 1,

    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,

    pickable: true,

    updateTriggers: {
      // Re-evaluate fill whenever hover changes or canvas resizes
      getFillColor: [hoveredId],
      // Re-project positions when canvas dimensions change
      getPosition: [cssW, cssH, plotW, plotH],
    },

    // GPU-side attribute interpolation — no manual RAF loop needed
    transitions: {
      getPosition: { duration: ANIM_MS, easing: cubicInOut },
    },
  });
}

function updateDeckView() {
  if (!deckInstance) return;
  deckInstance.setProps({
    width:  cssW,
    height: cssH,
    views: new OrthographicView({
      id: 'ortho',
      // flipY: true (default) — y increases downward, matching CSS
    }),
    viewState: {
      target: [cssW / 2, cssH / 2, 0],
      zoom:   0,
      minZoom: -Infinity,
      maxZoom:  Infinity,
    },
    layers: [buildLayer()],
  });
}

const deckInstance = new Deck({
  canvas: deckCanvas,        // use our own canvas element
  width:  600,               // updated by resize()
  height: 400,
  useDevicePixels: true,

  views: new OrthographicView({ id: 'ortho' }),
  viewState: { target: [300, 200, 0], zoom: 0 },
  controller: false,         // no pan/zoom interaction
  getCursor: () => 'default', // suppress deck.gl's grab cursor
  pickingRadius: 20,         // snap to nearest dot within 20 px

  layers: [],

  onHover: ({ object }) => {
    const newId = object ? object.id : null;
    if (newId !== hoveredId) {
      hoveredId = newId;
      deckInstance.setProps({ layers: [buildLayer()] });
    }
  },
});

// ════════════════════════════════════════════════════════════════════════
// TRANSITION HELPER
// Merges old and new particle sets; deck.gl animates positions on the GPU.
// ════════════════════════════════════════════════════════════════════════

function transition(newPoints) {
  const oldParticles = particles;
  const newParticles = [];

  // 1) Update / keep existing active particles (position animation via deck.gl)
  for (let i = 0; i < Math.min(oldParticles.length, newPoints.length); i++) {
    newParticles.push({
      ...oldParticles[i],
      dx: newPoints[i].x,
      dy: newPoints[i].y,
      targetR: 4,
    });
  }

  // 2) Entering particles — appear at full radius
  for (let i = oldParticles.length; i < newPoints.length; i++) {
    newParticles.push({
      id: nextId++,
      dx: newPoints[i].x,
      dy: newPoints[i].y,
      targetR: 4,
    });
  }

  // 3) Exiting particles — removed immediately (no exit animation)

  particles = newParticles;
  deckInstance.setProps({ layers: [buildLayer()] });
}

// ════════════════════════════════════════════════════════════════════════
// RESIZE
// ════════════════════════════════════════════════════════════════════════

function resize() {
  const rect = chartDiv.getBoundingClientRect();
  cssW  = rect.width;
  cssH  = rect.height;
  plotW = cssW  - margin.left - margin.right;
  plotH = cssH  - margin.top  - margin.bottom;

  drawAxes();
  updateDeckView();
}

new ResizeObserver(resize).observe(chartDiv);

// ════════════════════════════════════════════════════════════════════════
// INITIAL RENDER
// ════════════════════════════════════════════════════════════════════════

// Bootstrap — resize() fires via ResizeObserver and triggers the first
// render, but we also call it manually to be safe.
requestAnimationFrame(() => {
  resize();
  transition(generateNormal(1000));
});

initControls({ onRender: transition });
