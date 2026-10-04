import { useCallback, useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

/**
 * The distance from the bottom of the hero to the first block after it, in px.
 *
 * Every gap between the links and the content below is this one number, so the
 * space is the same whether there are four links or forty - the links take the
 * room they need and this is all that is left after them.
 */
export const STACK_GAP = 32;

/**
 * How much of a viewport the pinned hero travels at minimum.
 *
 * The travel has to outlast the links unfolding, and it is a fraction of the
 * viewport rather than a fixed length so the hold feels the same on a laptop and
 * on a phone. The layout below may ask for more than this; it never gets less.
 */
export const MIN_TRAVEL_VH = 0.22;

export type StageLayout = {
  /** px the pinned hero holds before it releases into normal scroll */
  travel: number;
  /** px height of the hero section: one viewport plus the travel */
  stageHeight: number;
  /** `margin-top` the block after the hero needs to end up `gap` below the links */
  nextOffset: number;
};

/**
 * Where the pinned hero ends and where the block after it starts.
 *
 * The hero is one viewport tall and pinned, so the space under the links is not
 * a length anyone chose - it is whatever the viewport has left over after the
 * content, and it grows with the window. The block after the hero is pulled up
 * under it by `nextOffset` to close that space, which is why the offset is
 * negative and why it depends on the viewport height at all.
 *
 * Derived from the links' measured bottom instead of a snapshot of it, so
 * adding a link moves the block below it rather than changing the gap. The gap
 * itself is the same at every window size; the travel absorbs the difference.
 *
 * `travel` answers two wants and takes the longer: enough scroll for the unfold
 * to finish, and enough that the pulled-up block is still below the fold on the
 * first screen. The second is what keeps the corner hidden until a scroll at any
 * window height, since the pull alone would otherwise bring it into view on a
 * tall one.
 */
export function stageLayout({
  viewportH,
  linksBottom,
  gap = STACK_GAP,
  minTravelVh = MIN_TRAVEL_VH,
}: {
  viewportH: number;
  /** px from the top of the pinned box to the bottom of the links block, open */
  linksBottom: number;
  gap?: number;
  minTravelVh?: number;
}): StageLayout {
  const travel = Math.max(
    viewportH * minTravelVh,
    viewportH - linksBottom - gap,
  );

  return {
    travel,
    stageHeight: viewportH + travel,
    nextOffset: linksBottom + gap - viewportH,
  };
}

// One worked example, checked on every dev load: a 1400px window whose links end
// 942px down should put the corner on the fold at the first screen and 32px under
// the links once the hero releases. If the arithmetic is ever reworded, this is
// the line that goes red instead of the page.
if (import.meta.env.DEV) {
  const s = stageLayout({ viewportH: 1400, linksBottom: 942, gap: 32 });
  console.assert(
    s.stageHeight + s.nextOffset === 1400,
    "stage self-check: the corner should start on the fold",
    s,
  );
  console.assert(
    s.nextOffset + 1400 - 942 === 32,
    "stage self-check: the released gap should be the stack gap",
    s,
  );
}

/**
 * An element's top in layout px relative to an ancestor, ignoring any transform
 * an animation is applying. Walks the offset-parent chain, which is the only
 * geometry that stays still while motion scales a card.
 */
function layoutTop(el: HTMLElement, container: HTMLElement): number {
  let top = 0;
  for (
    let node: HTMLElement | null = el;
    node && node !== container;
    node = node.offsetParent as HTMLElement | null
  ) {
    top += node.offsetTop;
  }
  return top;
}

/**
 * The links block's open bottom, in layout px from the top of the pinned box.
 *
 * The grid is closed while this runs, and a closed grid is not the shape that
 * matters: in a two- or one-column layout a lower row is pushed down by the row
 * above it, and that push only exists once the row above is open. So the rows
 * are rebuilt from each card's own open height and the grid's real column count,
 * rather than read off the collapsed grid.
 *
 * Read through `offsetTop`/`offsetHeight` rather than `getBoundingClientRect`:
 * the cards run a layout animation on load, and a rect is scaled by that
 * transform while the layout values are not. A rect taken then reports a
 * squashed box and the block below is sized to it.
 */
function expandedLinksBottom(grid: HTMLElement, container: HTMLElement): number {
  const items = Array.from(grid.children) as HTMLElement[];
  if (items.length === 0) return 0;

  // Cards in one row share a top because the grid aligns its items to the start,
  // so counting the leading run of equal tops counts the columns. That is the
  // real layout, not a guess from `grid-template-columns`, which resolves
  // differently per engine.
  const firstTop = items[0].offsetTop;
  let columns = 0;
  for (const item of items) {
    if (item.offsetTop !== firstTop) break;
    columns += 1;
  }
  columns = Math.max(1, columns);

  const rowGap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
  const rows: number[] = [];
  items.forEach((item, index) => {
    const card = item.querySelector<HTMLElement>("[data-links-card]");
    if (!card) return;
    // The clip is the part that unrolls; the card's own box carries the header
    // and padding in both states.
    const open =
      card.offsetHeight -
      (card.querySelector<HTMLElement>("[data-links-clip]")?.offsetHeight ?? 0) +
      (card.querySelector<HTMLElement>("[data-links-list]")?.offsetHeight ?? 0);
    const row = Math.floor(index / columns);
    rows[row] = Math.max(rows[row] ?? 0, open);
  });

  const height =
    rows.reduce((total, row) => total + row, 0) +
    rowGap * Math.max(0, rows.length - 1);
  return layoutTop(grid, container) + height;
}

/**
 * The links block's open height, watched.
 *
 * Re-measured whenever the grid or a card changes size, the window resizes, or
 * a webfont lands late; `revision` is the escape hatch for changes those cannot
 * see, such as a live panel appearing above the grid. Every stage number below
 * the hero is derived from this, so a new link, a wrapped row or a different
 * column count moves the layout with no constant to update.
 */
export function useLinksBottom(
  containerRef: RefObject<HTMLElement | null>,
  revision: unknown,
): number {
  const [bottom, setBottom] = useState(0);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const grid = container?.querySelector<HTMLElement>("[data-links-grid]");
    if (!container || !grid) return;
    const next = expandedLinksBottom(grid, container);
    // Ignore sub-pixel churn, or the observer that reports the same box would
    // keep setting state in a loop.
    setBottom((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
  }, [containerRef]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    const observer = new ResizeObserver(measure);
    if (container) {
      observer.observe(container);
      container
        .querySelectorAll("[data-links-grid], [data-links-list]")
        .forEach((el) => observer.observe(el));
    }
    window.addEventListener("resize", measure);
    // A webfont arrives after first paint and changes every row's height.
    document.fonts?.ready.then(measure, () => {});
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, revision]);

  return bottom;
}
