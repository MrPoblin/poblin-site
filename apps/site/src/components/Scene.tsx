import { motion, type MotionValue } from "motion/react";
import { CloudField } from "../clouds/CloudField";
import type { CloudParams } from "../clouds/params";
import { SUN_IMAGE, SUN_TOP } from "../lib/scene";

export function Scene({
  params,
  spin,
  size,
  spread,
  face,
  sunR,
  sunScale,
  sunY,
  glow,
  still,
}: {
  params: CloudParams;
  spin: MotionValue<number>;
  size: MotionValue<number>;
  spread: MotionValue<number>;
  /** 1 while the profile picture is whole, 0 once the sun has become pure light */
  face: MotionValue<number>;
  sunR: number;
  sunScale: MotionValue<number>;
  sunY: MotionValue<number>;
  /** how much of the glow to draw: 1 is the full halo, a phone takes less */
  glow: number;
  still: boolean;
}) {
  const sunSize = sunR * 2;

  /**
   * The glow, in sun radii rather than pixels, so the halo is the same shape at
   * every sun size - these were tuned at a 106px radius, and a phone's sun is 86.
   * `glow` then dials the whole thing back on a phone, where the same halo covers
   * far more of the screen and reads as glare rather than as light.
   */
  const halo = (blur: number, spread: number, rgb: string, alpha: number) =>
    `0 0 ${Math.round(blur * sunR)}px ${Math.round(spread * sunR)}px rgba(${rgb}, ${(
      alpha * glow
    ).toFixed(3)})`;
  const discGlow = [
    halo(0.245, 0.057, "255,255,255", 0.95),
    halo(1.038, 0.472, "255,255,255", 0.6),
    halo(2.83, 1.415, "214,234,255", 0.34),
  ].join(", ");

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      <CloudField
        params={params}
        spin={spin}
        size={size}
        spread={spread}
        shiftY={sunY}
        still={still}
      />

      <div
        className="absolute"
        style={{
          left: "50%",
          top: `${SUN_TOP}%`,
          width: sunSize * 2.6,
          height: sunSize * 2.6,
          transform: "translate(-50%, -50%)",
          zIndex: 20,
        }}
      >
        <motion.div className="absolute inset-0" style={{ scale: sunScale, y: sunY }}>
          {/* The light. This is the bloom the cloud prototype's sun throws, and
              it is doing the same job here: the disc below is a picture, but the
              sky around it behaves as if it were lit by a star.
              The tail is held inside the layer on purpose. The layer is a circle
              of 2.6 sun-radii, while the gradient measures its stops to the far
              *corner* of that square - 3.68 radii. So a stop past ~70% lands
              outside the circle and gets sliced off mid-fade, which draws a hard
              arc around the sun. Ending the fade at 66% keeps a few percent of
              margin and the falloff reaches zero on its own. */}
          {/* the wrapper holds the phone's damping: the layer inside animates its
              own opacity, and an animation outranks an inline style */}
          <div className="absolute inset-0" style={{ opacity: glow }}>
            <div
              className="sun-breathe absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.5) 18%, rgba(255,255,255,0.36) 30%, rgba(236,246,255,0.2) 44%, rgba(206,230,255,0.08) 56%, rgba(190,222,255,0) 66%)",
              }}
            />
          </div>
          {/* The sun itself: a solid white disc, the same size as the picture and
              always there. The picture sits in front of it, so as the picture
              dissolves the sun is simply revealed. The glow lives here rather than
              on the picture, so it does not dim as the face goes.
              The first shadow is the rim; the two behind it carry the brightness
              further out. Each one fades to nothing well before the glow's visible
              edge, so the light never stops in a line. */}
          <div
            className="absolute left-1/2 top-1/2 rounded-full bg-white"
            style={{
              width: sunSize,
              height: sunSize,
              transform: "translate(-50%, -50%)",
              boxShadow: discGlow,
            }}
          />
          {/* The picture at its own colours. No wash and no white overlay: it
              reads as the profile, and the disc behind it plus the halo above are
              what make it a sun. */}
          <motion.img
            src={SUN_IMAGE}
            alt="Poblin"
            width={640}
            height={640}
            className="absolute left-1/2 top-1/2 rounded-full object-cover"
            style={{
              width: sunSize,
              height: sunSize,
              opacity: face,
              transform: "translate(-50%, -50%)",
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
