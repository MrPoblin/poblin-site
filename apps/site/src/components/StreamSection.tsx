import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Broadcast } from "@phosphor-icons/react";
import { streamChannel } from "../data/links";
import { DESKTOP_MIN, STAGE_VH } from "../lib/scene";
import { twitchEmbedUrl } from "../lib/twitch";
import { useMediaQuery } from "../lib/viewport";

export function StreamSection() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [nearby, setNearby] = useState(false);
  const isDesktop = useMediaQuery(`(min-width: ${DESKTOP_MIN}px)`);

  // The Twitch player is heavy, so it only loads once the frame is in sight.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || nearby) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearby(true);
          observer.disconnect();
        }
      },
      { rootMargin: "420px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nearby]);

  return (
    <section
      id="stream"
      className="relative mx-auto w-full max-w-5xl px-5 pb-14 pt-8 sm:pb-20 md:pt-0"
      // The hero's stage is longer than a screen, and the difference is exactly
      // the part where the page is not moving. Pulling this section up by that
      // much drops its top edge on the fold, so the whole panel rides up over the
      // pinned hero from the very first pixel of scrolling - while at rest it is
      // still out of sight. A phone has no pinned stage, so it takes the plain
      // gap instead.
      style={isDesktop ? { marginTop: `-${STAGE_VH - 100}vh` } : undefined}
    >
      <div className="glass-panel rounded-[32px] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
              24/7 Stream
            </h2>
            <p className="text-sm font-medium text-ink/65">
              Twitch · {streamChannel}
            </p>
          </div>

          <a
            href={`https://www.twitch.tv/${streamChannel}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 active:translate-y-px"
          >
            Open On Twitch
            <ArrowUpRight weight="bold" aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>

        <div
          ref={frameRef}
          className="relative aspect-video w-full overflow-hidden rounded-[22px] bg-night"
        >
          {nearby ? (
            <iframe
              title={`${streamChannel} Twitch stream`}
              src={twitchEmbedUrl(streamChannel)}
              className="absolute inset-0 h-full w-full border-0"
              // no allowFullScreen prop: `allow` already grants it, and having
              // both makes the browser log a precedence warning
              allow="autoplay; fullscreen; picture-in-picture"
            />
          ) : (
            <button
              type="button"
              onClick={() => setNearby(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/75 transition-colors duration-200 hover:text-white"
              style={{
                background:
                  "radial-gradient(circle at 50% 45%, rgba(145,70,255,0.35), rgba(6,28,64,0.9) 62%)",
              }}
            >
              <Broadcast weight="bold" aria-hidden="true" className="h-7 w-7" />
              <span className="font-display text-sm font-semibold tracking-wide">
                Play The 24/7 Stream
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
