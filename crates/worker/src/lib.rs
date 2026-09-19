#![forbid(unsafe_code)]
//! Thin `workers-rs` adapter over `poblin-core`.
//!
//! NOT DEPLOYED IN PART 1. `wrangler.toml` has no `main`, so this compiles in CI
//! and ships nowhere. It exists because the Rust -> wasm toolchain is the single
//! largest unknown in the whole plan: it is far cheaper to keep it verified on
//! every push than to discover it is unpleasant on the day the osu! API has to
//! work.
//!
//! Everything here is plumbing. Logic belongs in `poblin-core`, which has no
//! bindings and is testable without a runtime.
//!
//! Adding the first real route means: a handler in this file, `main` in
//! `wrangler.toml`, and `run_worker_first = ["/api/*"]` under `[assets]`. With a
//! script present, a non-navigation request that misses an asset reaches this
//! Worker instead of the 404 page, so the script must answer its own 404.

use worker::*;

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    Router::new()
        .get_async("/api/health", health)
        // Part 1 has no API routes. Anything else is an honest miss rather than a
        // 404 page, because the request is not a navigation.
        .run(req, env)
        .await
}

/// Liveness plus the deployed commit, so a deploy can be confirmed from outside.
async fn health(_req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    Response::from_json(&serde_json::json!({
        "ok": true,
        "sha": env!("CARGO_PKG_VERSION"),
        "commit": option_env!("GIT_SHA").unwrap_or("dev"),
    }))
}
