import { useEffect, useState } from "react";

/**
 * Who is live right now, on any of the channels this page cares about?
 *
 * Twitch's REST API (Helix) needs an app access token, and minting one needs the
 * client secret, which cannot live in a static page. The endpoint twitch.tv's own
 * web client uses does not need one: `gql.twitch.tv/gql` is readable straight from
 * the browser, and the client id below is the one Twitch hands to every visitor.
 * It is unofficial, so anything other than a clean answer means `unknown` - never
 * `offline`, and never a claim the page cannot back up.
 *
 * Every channel is asked for in one request, aliased, so watching two channels
 * costs one round trip rather than two.
 */
const GQL = "https://gql.twitch.tv/gql";
const WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
/** how often to re-ask while the page is open, so the page can follow the stream */
const POLL_MS = 60_000;

const FIELDS = "stream { id type viewersCount } broadcastSettings { title }";

export type LiveStatus = "unknown" | "live" | "offline";

export type ChannelLive = {
  status: LiveStatus;
  /** the stream's title while live */
  title: string | null;
  viewers: number | null;
  /** where to send someone who taps through */
  url: string;
};

const urlFor = (login: string) => `https://www.twitch.tv/${login}`;

const unknown = (login: string): ChannelLive => ({
  status: "unknown",
  title: null,
  viewers: null,
  url: urlFor(login),
});

/** the embed both players use, so the hero and the 24/7 section cannot drift */
export function twitchEmbedUrl(channel: string, muted = true, autoplay = false) {
  const host =
    typeof window === "undefined" || !window.location.hostname
      ? "localhost"
      : window.location.hostname;
  return `https://player.twitch.tv/?channel=${channel}&parent=${host}&muted=${muted}&autoplay=${autoplay}`;
}

export async function checkTwitchChannels(
  logins: string[],
): Promise<Record<string, ChannelLive>> {
  const result: Record<string, ChannelLive> = {};
  for (const login of logins) result[login] = unknown(login);

  try {
    const selection = logins
      .map((login, i) => `c${i}: user(login: ${JSON.stringify(login)}) { ${FIELDS} }`)
      .join("\n");
    const res = await fetch(GQL, {
      method: "POST",
      headers: { "Client-Id": WEB_CLIENT_ID, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `query LiveStatus { ${selection} }` }),
    });
    if (!res.ok) throw new Error(`twitch gql ${res.status}`);
    const json = await res.json();

    logins.forEach((login, i) => {
      const user = json?.data?.[`c${i}`];
      if (!user) return; // leave this one unknown, keep the others
      const stream = user.stream;
      result[login] = {
        status: stream ? "live" : "offline",
        title: user.broadcastSettings?.title ?? null,
        viewers: typeof stream?.viewersCount === "number" ? stream.viewersCount : null,
        url: urlFor(login),
      };
    });
  } catch {
    // network, quota, a changed endpoint: every channel stays unknown
  }

  return result;
}

/**
 * Checks on mount and then every minute, but only while the tab is visible: a
 * bio page left open in a background tab costs nothing.
 */
export function useTwitchChannels(logins: string[]): Record<string, ChannelLive> {
  const key = logins.join(",");
  const [state, setState] = useState<Record<string, ChannelLive>>(() =>
    Object.fromEntries(logins.map((login) => [login, unknown(login)])),
  );

  useEffect(() => {
    const channels = key ? key.split(",") : [];
    let cancelled = false;
    let timer = 0;

    const ask = async () => {
      const next = await checkTwitchChannels(channels);
      if (!cancelled) setState(next);
    };

    void ask();
    timer = window.setInterval(() => {
      if (!document.hidden) void ask();
    }, POLL_MS);

    const onVisible = () => {
      if (!document.hidden) void ask();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key]);

  return state;
}
