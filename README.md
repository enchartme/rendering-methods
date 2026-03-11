# Rendering Methods Comparison

A side-by-side educational comparison of four ways to render an animated scatterplot in the browser. Each page shows the same 100–100 000 random data points with enter/update/exit animations, a hover highlight, and interactive controls — implemented with a completely different rendering stack.

| Page | Renderer | File |
|---|---|---|
| **SVG** | D3 v7 data join → SVG `<circle>` elements | `index.html` |
| **Canvas** | Canvas 2D API, manual particle loop + `requestAnimationFrame` | `canvas.html` |
| **WebGL** | Raw WebGL 1, hand-written GLSL vertex + fragment shaders | `webgl.html` |
| **deck.gl** | deck.gl `ScatterplotLayer` with GPU-side attribute transitions | `deckgl.html` |

Every page navigates to its siblings via a shared nav bar and shows an annotated code snippet below the chart highlighting the key rendering concept.

## Shared modules

| File | Purpose |
|---|---|
| `shared.css` | Layout, buttons, nav, code-panel styles — loaded by all four pages |
| `data.js` | `generateUniform(n)` and `generateNormal(n)` — plain global functions |
| `controls.js` | `initControls({ onRender })` — wires the distribution + point-count buttons |

## How to run

The pages are plain HTML files with no build step. Serve them from any static HTTP server — a direct `file://` open will work for SVG and Canvas, but WebGL and deck.gl require an HTTP origin due to browser security restrictions.

**Option 1 — Python (built-in)**
```bash
cd rendering-methods
python3 -m http.server 8080
# open http://localhost:8080
```

**Option 2 — Node.js (`npx serve`)**
```bash
cd rendering-methods
npx serve .
# follow the URL printed to the terminal
```

**Option 3 — VS Code Live Server**  
Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension, right-click any `.html` file, and choose *Open with Live Server*.

## Controls

| Button | Action |
|---|---|
| **Uniform** | Switch to Uniform(0, 1) distribution |
| **Normal** | Switch to Normal(μ=0.5, σ=0.15) distribution |
| **÷10** | Divide the point count by 10 (min 10) |
| **×10** | Multiply the point count by 10 |

## Dependencies (all CDN, no install needed)

- [D3 v7](https://d3js.org/) — SVG page only
- [deck.gl](https://deck.gl/) standalone bundle — deck.gl page only
- [highlight.js 11](https://highlightjs.org/) + `atom-one-dark` theme — all pages, for code snippet syntax highlighting
