import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Reproduces Cloudflare's `not_found_handling = "404-page"` (see wrangler.toml) on
 * the local servers, so a miss serves the 404 document with a real 404 status
 * exactly the way the origin does.
 *
 * Both of Vite's defaults are wrong for this site. `"spa"` rewrites every
 * unmatched path to index.html, so a typo showed the bio page and the 404 was
 * unreachable. `"mpa"` fixes the status but leaves the page reachable only at its
 * literal /404.html path, so /404 itself 404s. Reproducing the production rule is
 * the only arrangement where local and production agree — which is the entire point
 * of `pnpm preview`.
 */
const notFoundPage: Connect.NextHandleFunction = (req, res, next) => {
  const request = req as { url?: string };
  const path = (request.url ?? "/").split("?")[0];
  // Anything with an extension is a real asset request. Let those 404 on their own
  // rather than answering a missing .js or .webp with an HTML document.
  if (path.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(path)) return next();
  // Vite's static/html middleware sets 200 on the way out; force the real status so
  // a typo cannot masquerade as a working page (a soft 404). Two hooks because the
  // two code paths exit differently: the static middleware assigns res.statusCode
  // and calls end() without ever calling writeHead, while the html middleware goes
  // through writeHead. Patching only one of them leaves a 200 on the other path.
  const response = res as {
    writeHead: unknown;
    end: unknown;
    statusCode: number;
    headersSent: boolean;
  };
  const originalWriteHead = res.writeHead.bind(res) as (
    code: number,
    ...rest: unknown[]
  ) => unknown;
  response.writeHead = (status: number, ...rest: unknown[]) =>
    originalWriteHead(status === 200 ? 404 : status, ...rest);
  const originalEnd = res.end.bind(res) as (...args: unknown[]) => unknown;
  response.end = (...args: unknown[]) => {
    // Only when nothing has been flushed yet: once headers are sent the status is
    // already on the wire and rewriting it is impossible.
    if (!response.headersSent) response.statusCode = 404;
    return originalEnd(...args);
  };
  request.url = "/404.html";
  next();
};

const serveProduction404 = (): Plugin => ({
  name: "poblin:serve-production-404",
  // The returned function is a post hook: it runs after Vite's own middlewares are
  // installed, so this only sees requests nothing else could answer. Applies to
  // `vite dev` and `vite preview` only; `vite build` ignores both hooks.
  configureServer: (server) => () => server.middlewares.use(notFoundPage),
  configurePreviewServer: (server) => () => server.middlewares.use(notFoundPage),
});

export default defineConfig({
  plugins: [react(), tailwindcss(), serveProduction404()],
  // Required alongside the plugin above: with Vite's default "spa" fallback in
  // place, every unmatched path becomes index.html before the plugin can see it.
  appType: "mpa",
  build: {
    // Two documents: the bio page, and the 404 Cloudflare serves for a miss
    // (`not_found_handling = "404-page"` needs a real dist/404.html, and nearest
    // wins, so each corner can ship its own). Building the 404 as an entry rather
    // than parking it in public/ is what gets it the real Fredoka face and the
    // shared design tokens instead of a system-font lookalike.
    rollupOptions: {
      input: {
        main: "index.html",
        notfound: "404.html",
      },
    },
    // ES2022 covers every browser that has the features this site actually needs
    // (WebGL2, `dvh` units, modulepreload) and drops the transpilation downlevel
    // padding older targets would add.
    target: "es2022",
    // No sourcemaps in production. They would publish the full source and grow the
    // payload for no runtime benefit; enable locally when debugging.
    sourcemap: false,
    // Every browser in the es2022 target supports modulepreload natively, so the
    // polyfill is dead weight — and it is injected as an inline script, which a
    // strict `script-src 'self'` would block. Two reasons, same switch.
    modulePreload: { polyfill: false },
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
  server: {
    host: true,
    port: 5178,
    open: false,
  },
});
