import { motion, type MotionValue } from "motion/react";
import { SUN_TOP } from "../lib/scene";
import { useViewport } from "../lib/viewport";

const AT = `50% ${SUN_TOP}%`;

/**
 * The sun is the light source, so every layer of the sky falls off radially from
 * it rather than running top-to-bottom: the body of the sky darkening toward the
 * corners, and a cyan lift in the top-left corner.
 *
 * The white bloom is NOT in here. It used to be, and it stayed pinned at the
 * sun's resting anchor while the sun itself settled further down the screen - so
 * scrolling left a patch of light behind, glowing at a sun that had moved. It is
 * its own element now, riding the same offset as the sun.
 */
const SKY_STACK = [
  `radial-gradient(circle at ${AT}, #57a0ee 0%, #4185e2 9%, #2f6ed6 22%, #2360c4 36%, #1a4cab 54%, #133a8b 72%, #0d2b6a 88%, #081f50 100%)`,
  `radial-gradient(ellipse 120% 90% at 8% 4%, rgba(126,178,255,0.16) 0%, rgba(126,178,255,0) 55%)`,
].join(", ");

/**
 * The bloom, as its own element so it can travel with the sun.
 *
 * Its stops are the ones the sky stack used to carry, measured against the same
 * thing: the distance from the sun to the farthest corner of the screen. That is
 * the whole trick - sized this way it is *exactly* the gradient it replaces, at
 * any window size. Sizing it from the sun's radius instead looked right at one
 * window size and silently shrank the glow as the window grew, because the sun's
 * radius is capped while the corner distance is not.
 *
 * On a square element `closest-side` is that distance, so the original
 * percentages carry over verbatim.
 */
const HALO =
  "radial-gradient(circle closest-side, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 3%, rgba(240,248,255,0.6) 8%, rgba(214,232,255,0.28) 17%, rgba(190,222,255,0) 30%)";

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E")`;

const LINES =
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, rgba(4,16,44,0.35) 1px, rgba(4,16,44,0.35) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)";

export function SkyBackdrop({
  sunY,
  glow,
}: {
  /** the sun's own scroll offset, so the light it casts moves with it */
  sunY: MotionValue<number>;
  /** how much of the glow to draw: 1 is the full halo, a phone takes less */
  glow: number;
}) {
  const { w, h } = useViewport();
  // the sun's anchor, and how far the farthest corner of the screen is from it
  const top = (SUN_TOP / 100) * h;
  const reach = Math.max(Math.hypot(w / 2, top), Math.hypot(w / 2, h - top));
  const span = Math.round(reach * 2);

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0, backgroundColor: "#071c45" }}
      aria-hidden="true"
    >
      <div className="absolute inset-0" style={{ background: SKY_STACK }} />

      {/* the sun's own light on the sky, kept behind the clouds where it belongs */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: `${SUN_TOP}%`,
          width: span,
          height: span,
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ y: sunY, opacity: glow, background: HALO }}
        />
      </div>

      {/* barely-there dither so the radial ramp cannot band */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{ backgroundImage: LINES, backgroundSize: "100% 4px" }}
      />

      <div
        className="absolute inset-0 opacity-[0.2] mix-blend-soft-light"
        style={{ backgroundImage: NOISE, backgroundSize: "160px 160px" }}
      />
    </div>
  );
}
