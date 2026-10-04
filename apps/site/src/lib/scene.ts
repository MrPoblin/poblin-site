/** Shared scene geometry so the backdrop, sun and clouds stay aligned. */
export const SUN_TOP = 21.5;

export const SUN_IMAGE = "/assets/poblin-sun.webp";

/**
 * Below this width the page is the phone layout: the copy stacks, the title is
 * not pinned, and the sun does not settle. The breakpoint lives here because the
 * sun's size and the scroll behaviour both key off it.
 */
export const DESKTOP_MIN = 768;

/**
 * The sun's radius as a fraction of the frame's short edge - the size the cloud
 * preset was authored against. Exported because the cloud layout is measured in
 * frame heights rather than in sun radii, so this doubles as the yardstick for
 * whether the ring currently sits at the distance it was composed at.
 */
export const SUN_SHORT_EDGE = 0.118;

export function sunRadius(w: number, h: number) {
  // On a phone the short edge is the width, and it is far smaller than the
  // height - so sizing off the short edge alone leaves a disc that reads as an
  // icon rather than as the sun of the page. There, size off the width.
  //
  // The phone factor is the knob for a bigger disc on a phone. At 390px wide:
  // 0.19 -> 148px across, 0.21 -> 164, 0.22 -> 172, 0.24 -> 187. Keep it in step
  // with TITLE_TOP.mobile below, because the sun and the name share the space
  // between them and a bigger sun eats the gap above the name.
  const short = Math.min(w, h) * SUN_SHORT_EDGE;
  const phone = w < DESKTOP_MIN ? w * 0.22 : 0;
  return Math.round(Math.min(136, Math.max(62, Math.max(short, phone))));
}

/**
 * Where the title sits, as a percentage of the viewport height, and therefore
 * where the sun comes to rest: the two are one decision, so they live together.
 *
 * `desktop` is **twice the sun's anchor**, which is exactly the value that makes
 * the gap from the top of the page down to the sun equal the gap from the sun
 * down to the name. The radius cancels out of that equation, so it holds at any
 * sun size and any window height - which is why it is derived rather than typed
 * as a number that would quietly stop being true. With the sun at 21.5 it lands
 * on 43.
 *
 * `mobile` is separate and higher, because the phone's copy sits above a shorter
 * list of chips. The same doubling would put it at 43.
 */
export const TITLE_TOP = { desktop: SUN_TOP * 2, mobile: 38 } as const;

/** How far the sun shrinks once the page is scrolled, and the gap it keeps
 *  above the title when it gets there. */
export const SUN_SETTLE_SCALE = 0.66;
export const SUN_GAP = 26;

/**
 * Scrolling, in viewport heights, before the sun has settled and is locked. The
 * shrink is a settle, not a slow drift, and it has to be finished inside the
 * stage's pinned travel - anything slower and the sun would still be moving as
 * the hero scrolls away.
 */
export const SUN_SETTLE_VH = 0.16;

/** Degrees the cloud field orbits over one viewport height of scrolling. Held
 *  apart from the stage length so shortening the stage cannot speed up the sky. */
export const ORBIT_DEG_PER_VH = 220;

/**
 * How much scrolling the face takes to dissolve, in viewport heights, starting
 * from the moment the categories have finished unfolding. The picture goes and
 * the light stays: what is left is the bloom, which is already bright white at
 * its centre, so the sun does not dim - it just stops being a person.
 */
export const FACE_FADE_VH = 0.5;

/**
 * How wide the ring is once the sky is fully zoomed out, in units of its
 * authored radius.
 *
 * The clouds shrink with the sun, and without this the ring would shrink with
 * them - a zoomed-out sky would pool into the middle of the screen with bare
 * blue at the corners. At 1 the field covers the same screen area at every zoom,
 * so the clouds simply fall apart into wider gaps as they get smaller. Slightly
 * above 1 pushes them the last of the way out to the edges.
 */
export const RING_SPREAD_END = 1.06;
