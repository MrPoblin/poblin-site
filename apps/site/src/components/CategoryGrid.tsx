import type { CSSProperties } from "react";
import { motion, type Transition } from "motion/react";
import { ArrowUpRight, CaretDown } from "@phosphor-icons/react";
import { categories, type Category } from "../data/links";
import { BrandIcon } from "./BrandIcon";

const brandOf = (category: Category) =>
  `#${category.glyph?.hex ?? "14509c"}`;

/**
 * Opening is eager and front-loaded, closing is even. The eager curve covers most
 * of the distance in its first few frames, which reads as a jump when it is played
 * in reverse - hence two of them.
 */
const OPEN: Transition = { duration: 0.34, ease: [0.16, 1, 0.3, 1] };
const CLOSE: Transition = { duration: 0.3, ease: [0.4, 0, 0.2, 1] };

function CategoryCard({
  category,
  expanded,
  openId,
  closed,
  onToggle,
}: {
  category: Category;
  expanded: boolean;
  openId: string | null;
  closed: string[];
  onToggle: (id: string) => void;
}) {
  // at the top of the page a category with one obvious destination is a plain
  // link; only once the page is scrolled do the categories unfold
  const isLink = !expanded && Boolean(category.href);
  // once unfolded, every card is open unless it has been closed by hand
  const open = expanded ? !closed.includes(category.id) : openId === category.id;
  const brandStyle = { "--brand": brandOf(category) } as CSSProperties;

  const head = (
    <>
      <span className="tile">
        <BrandIcon
          glyph={category.glyph}
          fallback={category.fallback}
          className="h-[1.05rem] w-[1.05rem]"
        />
      </span>
      <span className="flex-1 truncate text-left font-display text-[0.95rem] font-semibold text-ink">
        {category.name}
      </span>
      {isLink ? (
        <ArrowUpRight
          weight="bold"
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-ink/35"
        />
      ) : (
        <CaretDown
          weight="bold"
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-ink/50 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      )}
    </>
  );

  const headerClass = `flex w-full items-center gap-2.5 rounded-full p-0.5 text-left ${
    open ? "pr-2" : "pr-3"
  }`;

  return (
    <motion.li layout className="list-none">
      {/* One tree for both states, and it is always mounted. The entries keep
          their natural height while the clip box is closed, which is what lets
          the block below be placed against the open bottom before anything has
          been opened - a list that unmounted had nothing to measure. The three
          `data-links-*` hooks below are what `lib/stage` reads to do that.

          The radius is deliberately not animated and not swapped for
          `rounded-full`: that class resolves to a six-figure px value, so any
          transition toward it hands the browser a clamped radius of half the
          height the instant it starts, and the corners jump outwards and shrink.
          A constant 26px is already a pill on a 48px chip, so the shape morphs
          continuously as the card grows. */}
      <motion.div
        data-links-card
        style={brandStyle}
        className="glass-panel group w-full rounded-[26px] p-2"
      >
        {isLink ? (
          <a
            href={category.href}
            target="_blank"
            rel="noreferrer"
            className={headerClass}
          >
            {head}
          </a>
        ) : (
          <motion.button
            layout="position"
            type="button"
            onClick={() => onToggle(category.id)}
            aria-expanded={open}
            className={headerClass}
          >
            {head}
          </motion.button>
        )}

        <motion.div
          data-links-clip
          initial={false}
          animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
          transition={open ? OPEN : CLOSE}
          className="overflow-hidden"
          aria-hidden={!open}
          inert={!open}
        >
          <ul data-links-list>
            {category.entries.map((entry) => (
              <li key={entry.id}>
                <a
                  className="link-row"
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <BrandIcon
                      glyph={entry.glyph}
                      fallback={entry.fallback}
                      className="h-3.5 w-3.5 shrink-0 text-ink/70"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{entry.name}</span>
                      {entry.meta ? (
                        <span className="text-[0.68rem] font-semibold text-ink/60">
                          {entry.meta}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ArrowUpRight
                    weight="bold"
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 text-ink/35"
                  />
                </a>
              </li>
            ))}
          </ul>
        </motion.div>
      </motion.div>
    </motion.li>
  );
}

export function CategoryGrid({
  expanded,
  openId,
  closed,
  onToggle,
}: {
  expanded: boolean;
  openId: string | null;
  closed: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <motion.ul
      data-links-grid
      layout
      className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
    >
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          expanded={expanded}
          openId={openId}
          closed={closed}
          onToggle={onToggle}
        />
      ))}
    </motion.ul>
  );
}
