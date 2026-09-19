import type { CloudParams } from "./params";

/** Deterministic PRNG, so a seed always reproduces the same composition. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Floats per instance: r0, th0, halfSpan, thick, taperFactor, seed, opacity, pad. */
export const INSTANCE_STRIDE = 8;

export type CloudSet = { data: Float32Array; count: number };

/**
 * R2 low-discrepancy sequence. Two irrationals fill the annulus evenly without
 * leaving the grid lines a golden-angle sweep produces. Discrete rings are worse
 * still: with every cloud on one of N radii, the eye reads rails.
 */
const R2_A1 = 0.7548776662466927;
const R2_A2 = 0.5698402909980532;

/**
 * Builds the cloud set: a natural scatter around the sun.
 *
 * Placement is a 2D low-discrepancy sequence over the annulus, then a distance
 * test rejects anything that would sit on top of an accepted cloud. Separation
 * is therefore a property of the *scatter*, not of a slot, so clouds can sit at
 * any radius and any angle without ever forming a ring.
 *
 * Runs once at boot here: the site has no live sliders, so the set is built from
 * the exported preset and never rebuilt.
 */
export function buildClouds(p: CloudParams): CloudSet {
  const rnd = mulberry32(Math.max(1, Math.round(p.seed)));
  const inner = Math.max(0.05, Math.min(p.innerR, p.outerR));
  const outer = Math.max(inner + 0.05, Math.max(p.innerR, p.outerR));
  const total = Math.max(1, Math.round(p.count));
  const spread = outer - inner;

  const data = new Float32Array(total * INSTANCE_STRIDE);
  const placed: { x: number; y: number; reach: number }[] = [];
  let idx = 0;

  // plenty of attempts: rejection sampling needs room to find gaps
  const maxTries = total * 60;
  for (let i = 0; i < maxTries && idx < total; i++) {
    // sqrt keeps the scatter area-uniform rather than piling up near the sun
    const u = Math.sqrt((0.5 + R2_A1 * (i + 1) + rnd() * 0.08) % 1);
    const v = (0.5 + R2_A2 * (i + 1) + rnd() * 0.08) % 1;

    const r0 = inner + spread * u;
    const th0 = v * Math.PI * 2;

    const scale = Math.pow(r0 / inner, p.sizeGrade);
    const sizeMul = Math.exp((rnd() - 0.5) * 2 * p.sizeSpread);

    // Arc length is physical, so the same cloud is a tight curl near the sun and
    // a long sweep far out.
    const len = p.arcLenBase * scale * sizeMul * (1 + (rnd() - 0.5) * 2 * p.spanVar);
    const halfSpan = Math.min(len / (2 * r0), Math.PI * 0.8);
    if (halfSpan < 0.02) continue;

    const x = r0 * Math.cos(th0);
    const y = r0 * Math.sin(th0);
    // a curved arc occupies far less than its centre-to-tip length, so the
    // influence radius is a fraction of it
    const reach = 0.4 * len;

    let ok = true;
    for (const q of placed) {
      const dx = x - q.x;
      const dy = y - q.y;
      const need = p.spacing * (reach + q.reach);
      if (dx * dx + dy * dy < need * need) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    placed.push({ x, y, reach });

    const o = idx * INSTANCE_STRIDE;
    data[o + 0] = r0;
    data[o + 1] = th0;
    data[o + 2] = halfSpan;
    // Aspect varies independently of size, and widely: this is what puts
    // compact soft masses and long thin strokes in the same sky.
    data[o + 3] =
      p.thickBase * scale * sizeMul * Math.exp((rnd() - 0.5) * 2 * p.variety * 1.3);
    // per-cloud lobe exponent factor, multiplied by the global taper in the shader
    data[o + 4] = 0.55 + rnd() * 0.9;
    data[o + 5] = rnd() * 4000;
    data[o + 6] = 0.72 + rnd() * 0.28;
    data[o + 7] = 0;
    idx++;
  }

  return {
    data: idx === total ? data : data.subarray(0, idx * INSTANCE_STRIDE),
    count: idx,
  };
}
