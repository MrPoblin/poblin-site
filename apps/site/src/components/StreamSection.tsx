import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Broadcast } from "@phosphor-icons/react";
import { streamChannel } from "../data/links";
import { twitchEmbedUrl } from "../lib/twitch";

export function StreamSection() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [nearby, setNearby] = useState(false);

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
    // No negative margin on this section. The projects block above owns the pull over the pinned
    // hero, and a second one would drag this panel up through it; riding in that block's wake is
    // what puts this section on the fold at the first pixel of scrolling instead of a screen later.
    <section
      id="stream"
      className="relative mx-auto w-full max-w-5xl px-5 pb-14 pt-8 sm:pb-20 md:pt-0"
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
