import {
  siYoutube,
  siTwitch,
  siDiscord,
  siTiktok,
  siInstagram,
  siGithub,
} from "simple-icons";

export type BrandGlyph = {
  title: string;
  slug: string;
  hex: string;
  path: string;
};

export type FallbackIcon = "puzzle" | "share" | "wrench";

export type Entry = {
  id: string;
  name: string;
  href: string;
  meta?: string;
  glyph: BrandGlyph | null;
  fallback?: FallbackIcon;
};

export type Category = {
  id: string;
  name: string;
  glyph: BrandGlyph | null;
  fallback?: FallbackIcon;
  /** when present, the compact chip at the top of the page is a direct link */
  href?: string;
  entries: Entry[];
};

const toGlyph = (icon: {
  title: string;
  slug: string;
  hex: string;
  path: string;
}): BrandGlyph => ({
  title: icon.title,
  slug: icon.slug,
  hex: icon.hex,
  path: icon.path,
});

const youtube = toGlyph(siYoutube);
const twitch = toGlyph(siTwitch);
const discord = toGlyph(siDiscord);
const tiktok = toGlyph(siTiktok);
const instagram = toGlyph(siInstagram);
const github = toGlyph(siGithub);

export const categories: Category[] = [
  {
    id: "youtube",
    name: "YouTube",
    glyph: youtube,
    href: "https://www.youtube.com/@Poblin",
    entries: [
      {
        id: "youtube-main",
        name: "Main Channel",
        href: "https://www.youtube.com/@Poblin",
        meta: "@Poblin",
        glyph: youtube,
      },
      {
        id: "youtube-stream",
        name: "Stream Archive And 24/7",
        href: "https://www.youtube.com/@PoblinStream",
        meta: "@PoblinStream",
        glyph: youtube,
      },
      {
        id: "youtube-clips",
        name: "Clips",
        href: "https://www.youtube.com/@PoblinClips",
        meta: "@PoblinClips",
        glyph: youtube,
      },
    ],
  },
  {
    id: "twitch",
    name: "Twitch",
    glyph: twitch,
    href: "https://www.twitch.tv/poblin_",
    entries: [
      {
        id: "twitch-main",
        name: "Main Channel",
        href: "https://www.twitch.tv/poblin_",
        meta: "poblin_",
        glyph: twitch,
      },
      {
        id: "twitch-247",
        name: "24/7 Stream",
        href: "https://www.twitch.tv/poblin247",
        meta: "poblin247",
        glyph: twitch,
      },
    ],
  },
  {
    id: "social",
    name: "Other Social Media",
    glyph: null,
    fallback: "share",
    entries: [
      {
        id: "discord",
        name: "Discord",
        href: "https://discord.gg/6EaPyMsBUt",
        meta: "Server",
        glyph: discord,
      },
      {
        id: "tiktok",
        name: "TikTok",
        href: "https://www.tiktok.com/@pooblin",
        meta: "@pooblin",
        glyph: tiktok,
      },
      {
        id: "instagram",
        name: "Instagram",
        href: "https://www.instagram.com/poblin_ttv/",
        meta: "@poblin_ttv",
        glyph: instagram,
      },
    ],
  },
  {
    id: "software",
    name: "Software & Mods",
    glyph: null,
    fallback: "wrench",
    entries: [
      {
        id: "github",
        name: "GitHub",
        href: "https://github.com/MrPoblin",
        meta: "MrPoblin",
        glyph: github,
      },
      {
        id: "nexusmods",
        name: "Nexus Mods",
        href: "https://www.nexusmods.com/profile/Poblin",
        meta: "Profile",
        glyph: null,
        fallback: "puzzle",
      },
    ],
  },
];

const entryOf = (categoryId: string, entryId: string) =>
  categories
    .find((category) => category.id === categoryId)!
    .entries.find((entry) => entry.id === entryId)!;

/** the few channels worth surfacing in the nav */
export const quickLinks: Entry[] = [
  entryOf("youtube", "youtube-main"),
  entryOf("twitch", "twitch-main"),
  entryOf("social", "discord"),
];

/** the always-on 24/7 channel */
export const streamChannel = "poblin247";
/** the channel Poblin actually goes live on, so the hero can say so */
export const liveChannel = "poblin_";
