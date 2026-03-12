/**
 * controls.js — shared button-control wiring for the rendering-methods pages.
 *
 * Depends on data.js being loaded first (generateUniform, generateNormal).
 *
 * Usage:
 *   initControls({ onRender });
 *   initControls({ minN: 10, onRender });
 *
 * @param {{ minN?: number, onRender: (points: {x:number,y:number}[]) => void }} options
 *   minN      — minimum allowed point count (default 10)
 *   onRender  — called with a fresh point array whenever the user changes
 *               distribution or point count; the page's render function
 */
function formatN(n) {
  // narrow no-break space (U+202F) as thousands separator
  return n.toString().replace(/\B(?=(\d{3})+$)/g, '\u202f');
}

function initControls({ minN = 10, onRender }) {
  let n           = 1000;
  let currentDist = 'normal';

  const btnUniform = document.getElementById('btn-uniform');
  const btnNormal  = document.getElementById('btn-normal');
  const btnDiv10   = document.getElementById('btn-div10');
  const btnMul10   = document.getElementById('btn-mul10');
  const nDisplay   = document.getElementById('n-display');
  const subtitle   = document.getElementById('subtitle');

  function currentData() {
    return currentDist === 'uniform' ? generateUniform(n) : generateNormal(n);
  }

  function updateSubtitle() {
    if (!subtitle) return;
    const label = currentDist === 'uniform'
      ? 'Uniform(0, 1)'
      : 'Normal(\u03bc=0.5, \u03c3=0.15)';  // μ, σ
    subtitle.innerHTML =
      `${formatN(n)} data point${n !== 1 ? 's' : ''} \u2014 <strong>${label}</strong>`;
  }

  function refreshNDisplay() {
    nDisplay.textContent = formatN(n);
    btnDiv10.disabled    = n <= minN;
  }

  btnUniform.addEventListener('click', () => {
    if (currentDist === 'uniform') return;
    currentDist = 'uniform';
    btnUniform.classList.add('active');
    btnNormal.classList.remove('active');
    updateSubtitle();
    onRender(generateUniform(n));
  });

  btnNormal.addEventListener('click', () => {
    if (currentDist === 'normal') return;
    currentDist = 'normal';
    btnNormal.classList.add('active');
    btnUniform.classList.remove('active');
    updateSubtitle();
    onRender(generateNormal(n));
  });

  btnDiv10.addEventListener('click', () => {
    if (n <= minN) return;
    n = Math.max(minN, Math.floor(n / 10));
    updateSubtitle();
    refreshNDisplay();
    onRender(currentData());
  });

  btnMul10.addEventListener('click', () => {
    n *= 10;
    updateSubtitle();
    refreshNDisplay();
    onRender(currentData());
  });

  // Initialise display state — sync button active classes and count label
  if (currentDist === 'normal') {
    btnNormal.classList.add('active');
    btnUniform.classList.remove('active');
  } else {
    btnUniform.classList.add('active');
    btnNormal.classList.remove('active');
  }
  refreshNDisplay();
}
