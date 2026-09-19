import { quickLinks } from "../data/links";
import { BrandIcon } from "./BrandIcon";

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a
          href="#top"
          className="font-display text-lg font-semibold text-white lift-soft"
        >
          Poblin
        </a>
        <nav className="flex items-center gap-1.5" aria-label="Quick links">
          {/* No backdrop-blur here on purpose. These pills sit above the cloud
              canvas, which changes every frame, so a backdrop filter has to
              re-read and re-blur its backdrop on every one of those frames.
              Measured in Firefox, that cost more GPU than the entire cloud
              field. The translucent fill carries them instead. */}
          {quickLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              aria-label={link.name}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/20 text-white/95 transition-colors duration-200 hover:border-white/70 hover:bg-white hover:text-ink"
            >
              <BrandIcon
                glyph={link.glyph}
                fallback={link.fallback}
                className="h-4 w-4"
              />
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
