/**
 * data.js — shared point-cloud generation for the rendering-methods pages.
 *
 * Exports (as globals, since these pages use plain <script> tags):
 *   randNormal(mean?, sd?)  → single clamped normal-distributed value
 *   generateUniform(n)      → n points from Uniform(0,1) × Uniform(0,1)
 *   generateNormal(n)       → n points from Normal(μ=0.5,σ=0.15) × Normal(…)
 */

/**
 * Box-Muller transform → N(mean, sd²) value, clamped to (0.001, 0.999).
 * @param {number} [mean=0.5]
 * @param {number} [sd=0.15]
 * @returns {number}
 */
function randNormal(mean = 0.5, sd = 0.15) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(0.999, Math.max(0.001, mean + z * sd));
}

/**
 * Generate n points from Uniform(0, 1) × Uniform(0, 1).
 * @param {number} n
 * @returns {{ x: number, y: number }[]}
 */
function generateUniform(n) {
  return Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random() }));
}

/**
 * Generate n points from Normal(μ=0.5, σ=0.15) × Normal(μ=0.5, σ=0.15),
 * each coordinate clamped to (0.001, 0.999).
 * @param {number} n
 * @returns {{ x: number, y: number }[]}
 */
function generateNormal(n) {
  return Array.from({ length: n }, () => ({ x: randNormal(), y: randNormal() }));
}
