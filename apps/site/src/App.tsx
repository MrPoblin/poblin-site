import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { CategoryGrid } from "./components/CategoryGrid";
import { LiveBadge } from "./components/LiveBadge";
import { Nav } from "./components/Nav";
import { OsuCorner } from "./components/OsuCorner";
import { Scene } from "./components/Scene";
import { SkyBackdrop } from "./components/SkyBackdrop";
import { StreamSection } from "./components/StreamSection";
import { CLOUD_PARAMS } from "./clouds/params";
import { liveChannel, streamChannel } from "./data/links";
import {
  DESKTOP_MIN,
  FACE_FADE_VH,
  ORBIT_DEG_PER_VH,
  RING_SPREAD_END,
  STAGE_VH,
  SUN_GAP,
  SUN_SETTLE_SCALE,
  SUN_SETTLE_VH,
  SUN_SHORT_EDGE,
  SUN_TOP,
  TITLE_TOP,
  sunRadius,
} from "./lib/scene";
import { useMediaQuery, useViewport } from "./lib/viewport";
import { twitchEmbedUrl, useTwitchChannels } from "./lib/twitch";

/**
 * Scroll travel of the pinned stage lives in `lib/scene`, because the stream
 * section's overlap is derived from it. What is left here is the point at which
 * the categories unfold within that travel.
 */
const TRIGGER = 0.65;
/**
 * Scrolling before the categories unfold, in viewport heights.
 *
 * On a phone there is no pinned stage to take a fraction of, but the unfold
 * still wants the same trigger point, so it is stated once and used for both.
 */
const REVEAL_VH = TRIGGER * (STAGE_VH - 100);

/**
 * The fixed header is parked for now - flip this back to true to bring it back.
 * The component is untouched; only its render is switched off.
 */
const SHOW_HEADER = false;

/**
 * How the field catches up to the scroll. A wheel does not scroll smoothly, it
 * jumps a notch at a time, and a rotation wired straight to `scrollY` jumps with
 * it. The spring is tuned to land very close to critical damping - brisk, and
 * without ever working its way back, because a rotation that swings past its mark
 * and returns reads as a wobble rather than as motion.
 */
const SPIN_SPRING = { stiffness: 200, damping: 24, mass: 0.7 };

/**
 * A different sky on every visit. The seed is a plain function of the clock, so
 * no two loads share a composition, and any one of them can still be reproduced
 * exactly from the second it was drawn.
 */
function visitSeed() {
  return 1 + (Date.now() % 9999);
}

export default function App() {
  const reduce = useReducedMotion() ?? false;
  const { w, h } = useViewport();
  const isDesktop = useMediaQuery(`(min-width: ${DESKTOP_MIN}px)`);

  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  /** cards closed by hand since the last unfold, so a tap can beat the scroll */
  const [closed, setClosed] = useState<string[]>([]);
  const [seed] = useState(visitSeed);

  const stageRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  /**
   * The sun's glow is a fixed shape, so on a small screen the same halo covers
   * far more of the view and reads as glare. A phone draws this much of it. 1 is
   * the full halo; turn it down for less, up for more.
   */
  const sunGlow = isDesktop ? 1 : 0.8;

  const { scrollY } = useScroll();
  const twitch = useTwitchChannels([liveChannel, streamChannel]);
  const mainLive = twitch[liveChannel]?.status === "live" ? twitch[liveChannel] : null;
  const loopOffline = twitch[streamChannel]?.status === "offline";
  /**
   * The 24/7 window steps aside for a real broadcast, and goes away when the loop
   * is down. Note the asymmetry with the hero: an `unknown` answer *keeps* the
   * 24/7 window. This is the page's own content, so a failed status check must
   * not be what removes the stream - while a badge that cannot be verified simply
   * does not appear.
   */
  const showLoop = !mainLive && !loopOffline;

  const sunR = sunRadius(w, h);
  const titleTop = isDesktop ? TITLE_TOP.desktop : TITLE_TOP.mobile;

  /**
   * The sun settles over the first fraction of a screen of scrolling and then
   * stays locked just above the title. Its resting place is derived from where
   * the title sits rather than from a free-floating offset, so the two cannot
   * drift apart at any viewport size.
   */
  const travel = Math.max(1, h * SUN_SETTLE_VH);
  const sunRestY = (SUN_TOP / 100) * h;
  // On a phone the title is not pinned - it scrolls away with the page - so
  // there is nothing to lock the sun above, and moving it down would only walk
  // it into the text. There it shrinks where it stands.
  const sunSettledY = isDesktop
    ? (titleTop / 100) * h - SUN_GAP - sunR * SUN_SETTLE_SCALE
    : sunRestY;
  const rawSunScale = useTransform(scrollY, [0, travel], [1, SUN_SETTLE_SCALE], {
    clamp: true,
  });
  const rawSunY = useTransform(scrollY, [0, travel], [0, sunSettledY - sunRestY], {
    clamp: true,
  });
  // the field orbits as the page moves, at the rate the stage travels. It is
  // smoothed rather than fed straight from scrollY, so the orbit glides through
  // a wheel's jumps instead of stepping with them.
  const rawSpin = useTransform(
    scrollY,
    [0, Math.max(1, h)],
    [0, (ORBIT_DEG_PER_VH * Math.PI) / 180],
  );
  const smoothedSpin = useSpring(rawSpin, SPIN_SPRING);

  // The ring keeps its width as the clouds shrink, so a zoomed-out sky spreads
  // across the screen instead of drawing in around the sun. The two factors are
  // chosen together: cloud size and ring radius make the visible radius
  // (size + spread - 1), and that is what has to run 1 -> RING_SPREAD_END.
  const rawSpread = useTransform(
    scrollY,
    [0, travel],
    [1, RING_SPREAD_END - SUN_SETTLE_SCALE + 1],
    { clamp: true },
  );

  // Once the categories are open, scrolling on dissolves the picture and leaves
  // the light behind. Anchored to the reveal rather than an absolute distance, so
  // it can never start before the links are actually open.
  const faceStart = Math.max(1, (h * REVEAL_VH) / 100);
  const rawFace = useTransform(
    scrollY,
    [faceStart, faceStart + Math.max(1, h * FACE_FADE_VH)],
    [1, 0],
    { clamp: true },
  );

  const restOne = useMotionValue(1);
  const restZero = useMotionValue(0);
  const sunScale = reduce ? restOne : rawSunScale;
  const sunY = reduce ? restZero : rawSunY;
  const spin = reduce ? restZero : smoothedSpin;
  const spread = reduce ? restOne : rawSpread;
  const face = reduce ? restOne : rawFace;

  // Nothing in the field moves under reduced motion, so it is drawn once per
  // change instead of once per frame.
  //
  // The cloud layout is in frame heights from the sun, not in sun radii, so a
  // small sun does not pull the ring in with it - it just leaves the same ring
  // sitting proportionally further out, which is what a phone looks like. On a
  // phone the whole layout is therefore scaled with the sun, the same way the
  // field scales itself when the sun shrinks on scroll. Above the breakpoint the
  // sun is the size the preset was composed against, so nothing changes.
  const layoutScale = isDesktop
    ? 1
    : Math.min(1.1, Math.max(0.6, sunR / h / SUN_SHORT_EDGE));
  const cloudParams = useMemo(() => {
    const base = layoutScale === 1
      ? CLOUD_PARAMS
      : {
          ...CLOUD_PARAMS,
          innerR: CLOUD_PARAMS.innerR * layoutScale,
          outerR: CLOUD_PARAMS.outerR * layoutScale,
          arcLenBase: CLOUD_PARAMS.arcLenBase * layoutScale,
          thickBase: CLOUD_PARAMS.thickBase * layoutScale,
        };
    return {
      ...base,
      seed,
      drift: reduce ? 0 : CLOUD_PARAMS.drift,
      morph: reduce ? 0 : CLOUD_PARAMS.morph,
    };
  }, [reduce, seed, layoutScale]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const unfolded = !entry.isIntersecting;
        setExpanded(unfolded);
        // a fresh unfold opens everything again, however it was left by hand
        if (unfolded) setClosed([]);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * Unfolded, a tap closes that one card and leaves the rest open; collapsed, it
   * opens that one. Either way the tap wins until the next unfold.
   */
  const toggleCategory = (id: string) => {
    if (expanded) {
      setClosed((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    } else {
      setOpenId((prev) => (prev === id ? null : id));
    }
  };

  return (
    <>
      <SkyBackdrop sunY={sunY} glow={sunGlow} />
      <Scene
        params={cloudParams}
        spin={spin}
        size={sunScale}
        spread={spread}
        face={face}
        sunR={sunR}
        sunScale={sunScale}
        sunY={sunY}
        glow={sunGlow}
        still={reduce}
      />
      {SHOW_HEADER ? <Nav /> : null}

      <main className="relative" style={{ zIndex: 10 }}>
        <section
          id="top"
          ref={stageRef}
          className="relative"
          style={isDesktop ? { height: `${STAGE_VH}vh` } : undefined}
        >
          {/* Marks the point where the categories unfold. It is here on a phone
              too: there is no pinned stage to take a fraction of, so it is
              stated in viewport heights and used at every width. */}
          <div
            ref={sentinelRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{ height: `${REVEAL_VH}vh` }}
          />

          <div
            className={
              isDesktop
                ? "sticky top-0 flex h-[100dvh] flex-col justify-start"
                : "flex min-h-[100dvh] flex-col justify-start"
            }
            style={{ paddingTop: `${titleTop}vh` }}
          >
            <div className="mx-auto w-full max-w-6xl px-5">
              <h1 className="text-center font-display text-[clamp(4.25rem,10vw,6.5rem)] font-semibold leading-[1.02] text-white lift">
                Poblin
              </h1>
              {mainLive ? (
                // gap-5 matches the mt-5 above, so the badge sits evenly between
                // the name and the window rather than hugging the window
                <div className="mx-auto mt-5 flex w-full max-w-2xl flex-col items-center gap-5">
                  <LiveBadge live={mainLive} />
                  {/* the stream window, same treatment as the 24/7 one below */}
                  <div className="relative aspect-video w-full overflow-hidden rounded-[22px] bg-night shadow-[0_18px_40px_-18px_rgba(6,28,64,0.75)]">
                    <iframe
                      title={`${liveChannel} Twitch stream`}
                      src={twitchEmbedUrl(liveChannel)}
                      className="absolute inset-0 h-full w-full border-0"
                      allow="autoplay; fullscreen; picture-in-picture"
                    />
                  </div>
                </div>
              ) : null}
              <p className="mb-7 mt-3 text-center text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-white/85 lift-soft">
                Links
              </p>
              <CategoryGrid
                expanded={expanded}
                openId={openId}
                closed={closed}
                onToggle={toggleCategory}
              />
            </div>
          </div>
        </section>

        {/* The projects, under the links and above the 24/7 stream: the corner is the first one,
            and the ones after it land beside it rather than below. */}
        <OsuCorner />

        {showLoop ? <StreamSection /> : null}
      </main>
    </>
  );
}
