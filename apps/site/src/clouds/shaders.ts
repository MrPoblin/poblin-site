/**
 * The cloud primitive, ported verbatim from `CLOUDS/arc-clouds`.
 *
 * ## What it draws
 *
 * A cloud is an annular sector of the orbit about the sun. The fragment works in
 * polar coordinates about the sun, so the band is *inherently* curved - a single
 * flat quad carries a genuinely bent silhouette with no geometry and no
 * tessellation cost for the curvature.
 *
 * The profile is **asymmetric**: a `head` marks where the mass sits and the two
 * sides have independent extents and end characters. Crucially the trailing side
 * is not a lobe that fades - it is a *filament*: the thickness drops to a thin
 * line that persists almost to the tip and tapers to a point.
 *
 * ## What the site adds
 *
 * Three uniforms, all of them about the fact that the sun is not nailed down
 * here: it shrinks and settles above the title as the page scrolls.
 *
 * - `uScale` scales the whole field about the sun, so the clouds follow it in
 *   exactly the way the sprite field used to.
 * - `uShift` is how far the sun has moved from its anchor, in pixels - the field
 *   travels with it.
 * - `uSpin` is the scroll-driven rotation of the whole composition. It is added
 *   to each cloud's own angle, so the bend stays in each cloud's parameters
 *   rather than becoming a global transform of the finished image.
 *
 * The polar coordinates live in world space, which is sun-relative and therefore
 * untouched by those three: the sky is lit by a sun at the origin no matter where
 * that sun happens to be on screen.
 */

export const VERT = `#version 300 es
layout(location = 0) in vec2 aCorner;   // -1..1 quad
layout(location = 1) in vec4 aA;        // r0, th0, halfSpan, thick
layout(location = 2) in vec4 aB;        // taperFactor, seed, opacity, pad

uniform vec2  uRes;
uniform vec2  uSun;
uniform vec2  uShift;   // pixels the sun has moved from its anchor
uniform float uSize;    // cloud size: shrinks as the sun shrinks
uniform float uSpread;  // ring radius: pushes each cloud out along its own orbit
uniform float uSpin;    // scroll-driven rotation of the field, radians
uniform float uTime;
uniform float uDrift;
uniform float uTailCurl;

out vec2 vWorld;
out vec4 vA;
out vec4 vB;

void main() {
  float r0 = aA.x;
  float th0 = aA.y + uSpin + uTime * uDrift;
  float halfSpan = aA.z;
  float thick = aA.w;

  vec2 radial = vec2(cos(th0), sin(th0));
  vec2 tangent = vec2(-sin(th0), cos(th0));

  // Bounds, widened only as far as the shape can reach: the along-arc wander
  // pushes the silhouette by ~0.2 of the span, the maximum lump widens it by
  // ~2x thickness, and the tail hook swings the centreline by up to
  // |curl| * arcHalf. Every extra unit here is pure wasted fill.
  float arcHalf = r0 * halfSpan;
  float sag = r0 * (1.0 - cos(halfSpan));
  float curl = abs(uTailCurl) * arcHalf * 0.9;
  float along = r0 * sin(min(halfSpan * 1.45, 1.5)) + thick * 2.0 + 0.02;
  float across = sag * 0.8 + thick * 3.0 + curl + 0.02;
  vec2 center = radial * (r0 - sag * 0.5);

  vec2 world = center
             + tangent * (aCorner.x * along)
             + radial  * (aCorner.y * across);

  // Size and orbit are separate factors on purpose. Scaling the whole field
  // about the sun would shrink the clouds *and* pull the ring in with them,
  // which collapses a zoomed-out sky into the middle of the screen. Shrinking
  // the cloud while pushing it out along its own radius keeps the ring's spread
  // and lets the clouds fall apart into the wider gaps.
  vec2 spread = world * uSize + radial * (r0 * (uSpread - 1.0));

  vWorld = spread;
  vA = vec4(r0, th0, halfSpan, thick);
  vB = aB;

  // world -> pixels -> clip. uSun is in pixels from the bottom-left, matching
  // gl_FragCoord's origin, and uShift carries the sun's scroll motion.
  vec2 px = spread * uRes.y + uSun + uShift;
  gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const FRAG = `#version 300 es
precision highp float;
precision highp int;

in vec2 vWorld;
in vec4 vA;
in vec4 vB;
out vec4 outColor;

uniform sampler2D uNoise;
uniform float uTime;
uniform float uPixel;      // one device pixel, in world units
uniform float uSize;
uniform float uSpread;

uniform float uTaper;
uniform float uVariety;
uniform float uFlow;
uniform float uTailCurl;
uniform float uFilament;
uniform float uBodyMin;
uniform float uEndFade;
uniform float uAlongWarp;
uniform float uSpineWobble;

uniform float uErode;
uniform float uEdgeRag;
uniform float uDetailScale;
uniform float uSoft;
uniform float uContrast;
uniform float uLump;
uniform float uBump;
uniform int   uOctaves;

uniform float uAmbient;
uniform float uRim;
uniform float uGlow;
uniform float uGlowFall;
uniform vec3  uShadow;

uniform float uSilhouette;

const float NOISE_SIZE = 256.0;

/* One bilinear fetch replaces eight hash calls. This was the single biggest
   cost reduction measured in orbit-clouds. */
float vnoise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 uv = (p.xy + vec2(37.0, 239.0) * p.z) + f.xy;
  vec2 rg = texture(uNoise, (uv + 0.5) / NOISE_SIZE).yx;
  return mix(rg.x, rg.y, f.z);
}

float vnoise2(vec2 p) { return vnoise3(vec3(p, 0.0)); }

/* Rotate between octaves as well as scaling, or every octave lands on the same
   axes and the field shows a visible grid. */
float fbm2(vec2 p, int oct) {
  float v = 0.0;
  float a = 0.5;
  float n = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    v += a * vnoise2(p);
    n += a;
    p = vec2(p.x * 0.8 - p.y * 0.6, p.x * 0.6 + p.y * 0.8) * 2.02;
    a *= 0.5;
  }
  return v / max(n, 1e-4);
}

/* Precision-friendly scalar hash (Hoskins). sin-based hashes break down on large
   seeds, and these seeds run into the thousands. */
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  float r0 = vA.x;
  float th0 = vA.y;
  float halfSpan = vA.z;
  float thick = vA.w;

  float taperFactor = vB.x;
  float seed = vB.y;
  float opacity = vB.z;

  float arcHalf = max(r0 * halfSpan, 1e-4);
  float curlReach = abs(uTailCurl) * arcHalf * 0.9;

  /* ---- undo the field transform ------------------------------------------
     The polar maths below is the cloud's own, and it has to run in the space it
     was authored in. The vertex moved this instance outward along its own radius
     and scaled it; the offset is a pure radial vector, so it comes straight back
     out and leaves the angle untouched. */
  vec2 radialDir = vec2(cos(th0), sin(th0));
  vec2 world = (vWorld - radialDir * (r0 * (uSpread - 1.0))) / uSize;

  /* ---- cheap rejects, before any noise ---------------------------------- */
  float rho = length(world);
  float reach = thick * 3.2 + curlReach;
  if (rho > r0 + reach || rho < r0 - reach) discard;

  float th = atan(world.y, world.x);
  float dth = th - th0;
  dth = atan(sin(dth), cos(dth));   // wrap to [-pi, pi]

  float u = dth / halfSpan;
  if (abs(u) >= 1.45) discard;

  /* ---- this cloud's own shape, derived from its seed ---------------------
     A shared base profile with a per-cloud noise offset is not variety - the
     eye still sees one shape repeated. */
  float h1 = hash11(seed * 1.13 + 3.7);
  float h2 = hash11(seed * 2.71 + 11.3);
  float h3 = hash11(seed * 3.97 + 27.1);
  float h4 = hash11(seed * 5.31 + 5.9);
  float h5 = hash11(seed * 7.19 + 41.3);
  float h6 = hash11(seed * 9.73 + 63.1);

  float taper = max(0.25, uTaper * taperFactor * (1.0 + uVariety * (h1 * 1.8 - 0.9)));
  float bodyMin = clamp(uBodyMin * (0.4 + 1.3 * h2), 0.004, 0.4);
  float endFade = clamp(uEndFade * (0.5 + 1.0 * h3), 0.02, 0.9);
  // where the mass sits along the arc; flow at 1 makes every cloud trail the same
  // way, so the wisps read as one orbital current rather than a scatter
  float head = mix(h4 * 1.5 - 0.75, -0.5, uFlow);
  float leadShape = h5;
  float trailShape = h6;
  // Both ends reach out. Suppressing the leading wisp on some clouds meant those
  // clouds ended in a bare lobe, and a bare lobe tapers to a point.
  float leadWisp = mix(0.6, 1.0, h2);
  // Always present, and never near zero. A wisp that can be dialled away is a
  // wisp that is not there, and the cloud falls back to a bare lobe.
  float filament = uFilament * (0.6 + 0.8 * h5);

  /* ---- noise, in cloud-relative coordinates ------------------------------ */
  vec2 seedOff = vec2(fract(seed * 0.618034), fract(seed * 0.381966)) * 41.0;

  /* ---- asymmetric profile ------------------------------------------------
     Independent extents and end characters either side of the head. */
  float ue = u + (fbm2(vec2(u, (rho * dth) / arcHalf) * 0.8 + seedOff.yx + 7.0, 2)
                   - 0.5) * uAlongWarp;
  float d = ue - head;

  float leadExt = head + 1.0;
  float trailExt = 1.0 - head;
  if (d < -leadExt || d > trailExt) discard;

  float ext = d < 0.0 ? leadExt : trailExt;
  float e = min(1.0, abs(d) / max(ext, 1e-3));

  bool lead = d < 0.0;

  // the lobe: the cloud's mass
  float lobeRounded = 1.0 - e * e;
  float lobeTapered = pow(max(1.0 - e, 0.0), taper);
  float lobe = mix(lobeRounded, lobeTapered, lead ? leadShape : trailShape);

  // The wisp decays SLOWLY, and that is the whole fix for the ends. While both
  // the body and the wisp were steep functions of the same e, the wisp could only
  // thicken the last sliver before the tip - it could never carry the cloud any
  // further, so every cloud still stopped where its lobe stopped and the ends
  // read as <>. With a long decay the body thins away while the wisp keeps going,
  // and the end reaches out to the sides as a stroke.
  float wisp = filament * pow(max(1.0 - e, 0.0), 0.32);
  // bodyMin applies to the LOBE only. Applied to the whole profile it also floors
  // the wisp, which turns the stroke into a constant-width line that has to be cut
  // off instead of tapering away - i.e. exactly the abrupt end we are fixing.
  float prof = max(max(lobe, bodyMin), wisp * (lead ? leadWisp : 1.0));

  // noise in cloud-relative space, scaled by this cloud's own half-length and
  // thickness; the centreline shift is removed first so the noise follows the
  // curl instead of sliding across it
  float cshift = uTailCurl * d * arcHalf * 0.9;
  // ...and the spine itself snakes, so the cloud is not a clean arc either
  cshift += (fbm2(vec2(d * 1.4, 0.0) + seedOff.xy + 5.0, 2) - 0.5)
            * thick * uSpineWobble * 3.0;

  vec2 local = vec2((rho * dth) / arcHalf, (rho - r0 - cshift) / max(thick, 1e-4))
             * uDetailScale + seedOff;
  local += vec2(0.7, 1.0) * uTime * 0.35;

  float n = fbm2(local, uOctaves);
  float rag = fbm2(local * 3.3 + seedOff.yx + 19.0, 2) - 0.5;
  // rounded bulges along the arc: the bouncy cumulus edges
  float bumps = fbm2(local * 0.5 + 33.0, 2);

  // The two edges get their own noise. Sharing one radius mirrors the top and
  // bottom outlines exactly, and a mirrored outline is most of why the result
  // still read as a geometric form: every cloud was symmetrical about its own
  // spine, which no cloud is.
  float edgeTop = fbm2(local * 0.9 + seedOff.yx + 51.0, 2);
  float edgeBot = fbm2(local * 0.9 + seedOff.xy + 83.0, 2);

  float dr = rho - r0 - cshift;
  float side = dr >= 0.0 ? edgeTop : edgeBot;
  float lump = clamp(
    1.0 + uLump * ((n - 0.5) * 1.0 + (bumps - 0.5) * 1.8 + (side - 0.5) * 2.6),
    0.12, 2.3);
  float rwRaw = thick * prof * lump;

  // Keep the thinnest wisps from falling below a pixel, and pay for the clamped
  // coverage in alpha: without this, thin strokes alias and strobe.
  float rw = max(rwRaw, uPixel * 0.8);
  float cover = clamp(rwRaw / rw, 0.0, 1.0);

  float v = dr / rw;
  if (abs(v) >= 1.0) discard;

  float q = abs(v) + rag * uEdgeRag;
  float edge = 1.0 - q;

  // Erosion applies to the body. A thin wisp is left crisp, or the noise eats
  // the stroke that gives the end its shape.
  float ero = uErode * (0.5 - n) * 2.0 * smoothstep(0.02, 0.3, prof);
  float dens = smoothstep(0.0, uSoft, edge - ero);

  // only the very tip fades, so the end reads as a stroke rather than a blur
  dens *= 1.0 - smoothstep(1.0 - endFade, 1.0, e);
  if (dens <= 0.002) discard;

  /* ---- shade ------------------------------------------------------------ */
  // the sun is the origin, so "toward the sun" is the inner radial direction
  float nr = clamp(v, -1.0, 1.0);     // -1 sun side .. +1 far side
  float lit = clamp(0.5 - 0.5 * nr * uContrast, 0.0, 1.0);
  lit = clamp(lit + (n - 0.5) * 2.0 * uBump, 0.0, 1.0);
  float light = uAmbient + (1.0 - uAmbient) * lit;

  vec3 col = mix(uShadow, vec3(1.0), light);

  float rim = pow(lit, 3.0) * smoothstep(0.5, 1.0, q) * uRim;
  col += vec3(rim);

  float glow = clamp(uGlow * exp(-r0 * uGlowFall), 0.0, 1.0);
  col = mix(col, vec3(1.0), glow);

  if (uSilhouette > 0.5) col = vec3(1.0);

  float a = dens * opacity * cover;
  outColor = vec4(col * a, a);   // premultiplied
}
`;
