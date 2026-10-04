/**
 * The osu! corner — the first of the projects under the links, and the way into `/osu/`.
 *
 * The disc is **drawn, not shipped as an image**. A white ring, a pink gradient and a field of
 * triangles are all shapes, so the mark is sharp at any size, scales from one number
 * (`--size` in the stylesheet) and adds no asset to the page. The values are measured off osu!'s own
 * mark rather than picked: the ring is 11% of the disc's radius, the disc runs `#f663a5` at the top to
 * `#d2558d` at the bottom, and the mesh is a dark pink over it.
 *
 * ## The mesh, and why it is one element
 *
 * The triangles drift upward, forever. The cost of an animation is per animated compositor layer, not
 * per triangle, so the whole field is **one repeating background** slid by exactly one tile height on
 * a linear loop — the same trick the corner's own triangle field uses, for the same reason. Nine
 * triangles cost one rasterised tile.
 *
 * Two properties of that trick are load-bearing:
 *
 * - **The travel must equal the tile height**, and the two are written as the same number in the
 *   stylesheet (`0.47em`), because a background that travels further than its tile jumps on the loop
 *   and one that travels less drifts out of place.
 * - **The tile wraps its triangles across its edges.** Triangles clipped by the tile boundary would
 *   sit on an invisible horizontal line that scrolls through the middle of the disc, which is far more
 *   visible than the same clipping is in a field hundreds of pixels wide. Drawing each triangle nine
 *   times, offset by ±one tile in both axes, makes the tile genuinely seamless.
 */

/**
 * The triangle mesh.
 *
 * **Equilateral, and nothing else.** osu!'s motif is an equilateral triangle, so the height is the
 * side times `√3/2` - a triangle drawn as tall as it is wide is isoceles and reads wrong at a
 * glance even when nobody can say why.
 *
 * The tile is a little under the disc's height, which makes the triangles a little over a third of
 * the disc at the top of their range. Sizes swing widely on purpose: osu!'s own field mixes
 * triangles several times bigger than each other, and a narrow range reads as a texture rather than
 * as the motif.
 *
 * Sizes are in tile units, where the tile is `TILE.size` wide and drawn at `0.9em` (see the
 * stylesheet). So `min: 30` is 30/200 of 0.9em, or about 13% of the disc, and `max: 90` about 40%.
 */
const TILE = { size: 200, count: 16, min: 30, max: 90, stroke: 0.7 };

const EQUILATERAL = Math.sqrt(3) / 2;

/**
 * The mesh as a data URI.
 *
 * Deterministic - a small linear congruential generator rather than `Math.random`, so the field is
 * identical on every load and the tile can be built once at module scope instead of per render.
 *
 * **Drawn in black.** The triangles are not painted in a colour at all: the layer is blended into the
 * disc with `multiply`, so the mesh darkens whatever the disc happens to be. That is what makes the
 * disc's colour a single editable value - a stroke in a fixed pink would have to be re-picked for
 * every colour anyone tries.
 */
function mesh(): string {
  let state = 0x9e3779b9;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const between = (a: number, b: number) => a + next() * (b - a);

  const triangle = (side: number, x: number, y: number) => {
    // Upright and unrotated, with a hairline outline: that is osu!'s motif. Scattered at random
    // angles it stops being a motif and becomes confetti. Inset so the stroke is never clipped.
    const s = side - TILE.stroke * 2;
    const height = s * EQUILATERAL;
    const left = x + TILE.stroke;
    const top = y + TILE.stroke;
    const points = [
      `${(left + s / 2).toFixed(1)},${top.toFixed(1)}`,
      `${(left + s).toFixed(1)},${(top + height).toFixed(1)}`,
      `${left.toFixed(1)},${(top + height).toFixed(1)}`,
    ].join(" ");
    return `<polygon points='${points}' fill='none' stroke='#000' stroke-width='${TILE.stroke}'/>`;
  };

  const shapes = Array.from({ length: TILE.count }, () => {
    const side = between(TILE.min, TILE.max);
    const height = side * EQUILATERAL;
    // Placement allows for the triangle's real height, not its side, or a wide one runs off the tile.
    const x = between(0, TILE.size - side);
    const y = between(0, TILE.size - height);
    // The nine copies: this tile, and the eight neighbours a triangle on an edge hangs over into.
    return [-1, 0, 1]
      .flatMap((dy) =>
        [-1, 0, 1].map((dx) =>
          triangle(side, x + dx * TILE.size, y + dy * TILE.size),
        ),
      )
      .join("");
  }).join("");

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE.size}' height='${TILE.size}'>${shapes}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const MESH = mesh();

export function OsuCorner({ offset }: { offset: number }) {
  return (
    <section
      id="projects"
      className="relative mx-auto w-full max-w-5xl px-5 pb-6 sm:pb-8"
      /**
       * How far this block rides up under the pinned hero, in px, from `lib/stage`.
       *
       * Negative on a desktop: the hero is a screen of pinned content anchored to
       * its top, so the space under the links is whatever the window has left, and
       * the block is pulled up by exactly that much so it lands one stack gap below
       * the links. It is derived from the links' measured height, so adding a link
       * moves this block instead of changing the gap.
       *
       * A phone has no pinned hero, so the offset is the plain stack gap.
       */
      style={{ marginTop: offset }}
    >
      {/* A list rather than a single centred item: the next project is one more child, and the row
          already centres and wraps when there is more than one. */}
      <ul className="flex flex-wrap items-start justify-center gap-6">
        <li className="list-none">
          <a
            className="osu-corner__link"
            href="/osu/"
            /**
             * No `target="_blank"`: this is a place on this site, not an outward link, and the whole
             * point of the transition is that the disc becomes the corner.
             */
          >
            <span className="osu-disc__beat">
              <span className="osu-disc">
                {/* The pink face is a child and not the disc itself, so the disc's own white shows
                    as the ring around it. It carries the clip, so the mesh is cut to the circle. */}
                <span className="osu-disc__face">
                  <span className="osu-disc__mesh">
                    <span
                      className="osu-disc__tri"
                      aria-hidden="true"
                      style={{ backgroundImage: MESH }}
                    />
                  </span>
                </span>
                <span className="osu-disc__text">
                  <span className="osu-disc__word">osu!</span>
                  <span className="osu-disc__sub">corner</span>
                </span>
              </span>
            </span>
          </a>
        </li>
      </ul>
    </section>
  );
}
