import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CaretDown } from "@phosphor-icons/react";
import { categories, type Category } from "../data/links";
import { BrandIcon } from "./BrandIcon";

const brandOf = (category: Category) =>
  `#${category.glyph?.hex ?? "14509c"}`;

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
      {/* One tree for both states. Swapping the whole card - a link when closed,
          a panel when open - used to unmount the rows, so the exit animation
          never ran and a closing card emptied in a single frame and deflated as
          a hollow pill. Only the header changes element now, and the rows always
          animate out. */}
      <motion.div
        style={{
          ...brandStyle,
          // Only the padding is transitioned. The radius is deliberately NOT
          // animated and NOT swapped for `rounded-full`: that class resolves to
          // ~22 million px, so any transition toward it hands the browser a
          // clamped radius of half the height the instant it starts - the
          // corners jump outwards and then shrink, which reads as a pulse. A
          // constant 26px is already a pill on a 48px chip (26 > 48/2, so it
          // clamps to 24), so the shape morphs continuously instead: 26px while
          // the card is taller than 52px, then the clamp takes it to 24px.
          transition: "padding 140ms ease-out",
        }}
        className={`glass-panel group w-full rounded-[26px] ${
          open ? "p-2" : "p-1.5"
        }`}
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

        <AnimatePresence initial={false}>
          {open ? (
            <motion.ul
              key="entries"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              // The eager, front-loaded curve feels right opening a panel and
              // reads as a jump closing one - it covers most of the distance in
              // the first couple of frames and then creeps. Closing gets an even
              // curve instead.
              exit={{
                height: 0,
                opacity: 0,
                transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
              }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
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
            </motion.ul>
          ) : null}
        </AnimatePresence>
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
