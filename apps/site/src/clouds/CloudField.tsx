import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import { buildClouds } from "./layout";
import type { CloudParams } from "./params";
import { CloudRenderer } from "./renderer";

type Props = {
  params: CloudParams;
  /** the sun's motion, applied to the whole field so the clouds ride with it */
  spin: MotionValue<number>;
  /** cloud size, scaled with the sun */
  size: MotionValue<number>;
  /** ring radius, pushed out as the sun shrinks so the sky still fills the screen */
  spread: MotionValue<number>;
  shiftY: MotionValue<number>;
  /** reduced motion: the field is drawn once per change instead of per frame */
  still: boolean;
};

/**
 * The cloud pass, as a fixed layer behind the page.
 *
 * The whole field is anchored to the sun, not to the viewport: it is the same
 * ring of clouds whether the sun is a full disc at rest or a small one settled
 * above the title. That is why the sun's motion is fed in as a transform of the
 * field rather than re-laid-out per frame - the composition is authored once and
 * then moved rigidly about its own light source.
 */
export function CloudField({ params, spin, size, spread, shiftY, still }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CloudRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: CloudRenderer;
    try {
      renderer = new CloudRenderer(canvas, params);
    } catch {
      // No WebGL2, or no context left for this canvas. The sky keeps its
      // gradient and its sun and simply has no clouds, which is a far better
      // outcome than an error boundary over a backdrop.
      return;
    }

    const set = buildClouds(params);
    renderer.setClouds(set.data, set.count);
    renderer.start();
    rendererRef.current = renderer;

    const onVisibility = () => renderer.setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
      rendererRef.current = null;
    };
    // StrictMode mounts twice in development. Disposing here is what lets the
    // second mount build its own resources on the canvas's shared context.
  }, [params]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const apply = () =>
      renderer.setField(spin.get(), size.get(), spread.get(), shiftY.get());
    apply();
    const offs = [
      spin.on("change", apply),
      size.on("change", apply),
      spread.on("change", apply),
      shiftY.on("change", apply),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [params, spin, size, spread, shiftY]);

  useEffect(() => {
    rendererRef.current?.setStill(still);
  }, [params, still]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
