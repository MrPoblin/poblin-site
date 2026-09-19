/**
 * The cloud prototype's single param object, kept verbatim so an exported
 * preset drops straight in: `Copy TS` in `CLOUDS/arc-clouds` emits exactly this
 * shape, and the only edit needed is pasting it over the values below.
 *
 * A cloud's shape lives in the shader (a polar SDF evaluated in each instance's
 * fragment), so these are uniforms plus one CPU layout pass at boot.
 */
export type CloudParams = {
  /* ---- layout ------------------------------------------------------------- */
  /** total clouds placed around the sun */
  count: number;
  /** innermost orbit radius, as a fraction of frame height */
  innerR: number;
  /** outermost orbit radius */
  outerR: number;
  /** how fast size grows with radius. 0 = all one size, 1 = proportional */
  sizeGrade: number;
  /** physical arc length of a cloud at the inner radius, in frame heights */
  arcLenBase: number;
  /** per-cloud variation of that length */
  spanVar: number;
  /** radial half-thickness of a cloud at the inner radius */
  thickBase: number;
  /** how much per-cloud SIZE varies, independent of shape */
  sizeSpread: number;
  /** minimum centre distance between clouds, as a fraction of their lengths.
   *  This is what keeps them separated without putting them on rails */
  spacing: number;
  seed: number;

  /* ---- shape -------------------------------------------------------------- */
  /** end pointedness: the exponent of the drawn-out lobe */
  taper: number;
  /** how thick the trailing wisp line is, relative to the body. This is what
   *  draws a cloud's end out into a stroke instead of fading it away */
  filament: number;
  /** how much noise eats the silhouette */
  erode: number;
  /** fine raggedness of the boundary */
  edgeRag: number;
  /** noise frequency. higher = busier detail */
  detailScale: number;
  /** alpha falloff at the boundary */
  soft: number;
  /** how much the noise swells and pinches the thickness along the arc */
  lump: number;
  /** how much the noise reads as surface relief in the lighting */
  bump: number;
  /** how much per-cloud shape varies */
  variety: number;
  /** how consistently the tails trail the same way around the orbit */
  flow: number;
  /** how far the tail hooks in or out along its length, so wisps curl */
  tailCurl: number;
  /** fraction of the arc over which the very tip fades. Small = crisp stroke */
  endFade: number;
  /** minimum thickness, so a lobe never tapers to a needle */
  bodyMin: number;
  /** how far the arc coordinate wanders, so edges are irregular */
  alongWarp: number;
  /** how far the cloud's spine snakes off its orbit, so it is not a clean arc */
  spineWobble: number;
  octaves: number;

  /* ---- light -------------------------------------------------------------- */
  ambient: number;
  contrast: number;
  rim: number;
  glow: number;
  glowFall: number;
  shadow: string;

  /* ---- motion ------------------------------------------------------------- */
  drift: number;
  morph: number;

  /* ---- cost --------------------------------------------------------------- */
  renderScale: number;
  fpsCap: number;

  /* ---- debug -------------------------------------------------------------- */
  silhouette: boolean;
}

/** The seed below is the tuned reference composition; the site swaps in a
 *  per-visit seed from the clock, so a fresh sky is drawn on every load. */
export const CLOUD_PARAMS: CloudParams = {
  count: 70,
  innerR: 0.15,
  outerR: 0.95,
  sizeGrade: 0.34,
  arcLenBase: 0.23,
  spanVar: 0.56,
  thickBase: 0.023,
  sizeSpread: 0.74,
  spacing: 0.5,
  seed: 4479,

  taper: 1.3,
  filament: 0.165,
  erode: 0.38,
  edgeRag: 0.05,
  detailScale: 3,
  soft: 0.6,
  lump: 0.65,
  bump: 0.6,
  variety: 0.5,
  flow: 0.78,
  tailCurl: 0,
  endFade: 0.42,
  bodyMin: 0.145,
  alongWarp: 0.19,
  spineWobble: 0.06,
  octaves: 5,

  ambient: 0,
  contrast: 1.7,
  rim: 0.86,
  glow: 0.06,
  glowFall: 4.35,
  shadow: "#4d78b4",

  drift: 0.044,
  morph: 0.055,

  renderScale: 0.5,
  fpsCap: 0,

  silhouette: false,
};
