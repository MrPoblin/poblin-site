import type { ComponentType } from "react";
import { PuzzlePiece, ShareNetwork, Wrench } from "@phosphor-icons/react";
import type { BrandGlyph, FallbackIcon } from "../data/links";

const FALLBACKS: Record<
  FallbackIcon,
  ComponentType<{ weight?: "bold"; className?: string; "aria-hidden"?: boolean }>
> = {
  puzzle: PuzzlePiece,
  share: ShareNetwork,
  wrench: Wrench,
};

export function BrandIcon({
  glyph,
  fallback = "puzzle",
  className,
}: {
  glyph: BrandGlyph | null;
  fallback?: FallbackIcon;
  className?: string;
}) {
  if (!glyph) {
    const Icon = FALLBACKS[fallback];
    return <Icon weight="bold" className={className} aria-hidden={true} />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={glyph.path} fill="currentColor" />
    </svg>
  );
}
