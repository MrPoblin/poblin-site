import type { ChannelLive } from "../lib/twitch";

/** 1234 -> 1.2k, because a viewer count is a vibe, not a statistic */
const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);

/**
 * The live marker that sits above the stream window. It stays even though the
 * player carries its own chrome, because it is the part that says "live right
 * now" before a single byte of the player has loaded - and it is the part that
 * still works if the embed decides not to.
 */
export function LiveBadge({ live }: { live: ChannelLive }) {
  return (
    <a
      href={live.url}
      target="_blank"
      rel="noreferrer"
      title={live.title ? `${live.title} - watch on Twitch` : "Watch on Twitch"}
      className="glass-panel flex w-fit max-w-full items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3.5 transition-transform duration-150 active:translate-y-px"
    >
      <span className="live-dot" aria-hidden="true" />
      <span className="shrink-0 font-display text-[0.72rem] font-semibold tracking-[0.16em] text-ink">
        LIVE
      </span>
      {live.viewers !== null ? (
        <span className="shrink-0 text-[0.72rem] font-semibold text-ink/50">
          {compact(live.viewers)} watching
        </span>
      ) : null}
    </a>
  );
}
