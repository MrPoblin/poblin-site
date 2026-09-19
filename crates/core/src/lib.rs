#![forbid(unsafe_code)]
//! Runtime-agnostic domain logic for poblin.live.
//!
//! Nothing here performs I/O, names a runtime, or mentions Cloudflare. That is the
//! point: `cargo test -p poblin-core` exercises the whole domain with no network,
//! no Worker and no emulator, and the same code runs unchanged behind the
//! `workers-rs` adapter or any future one.
//!
//! Part 1 holds the cache policy, because every upstream call the site will make
//! (osu!, GitHub, Twitch) must sit behind one shared cache: the osu! API allows 60
//! requests per minute for the *whole application* and its documentation mandates
//! caching. Getting the freshness arithmetic right, and proving it with tests, is
//! far cheaper than discovering it wrong against a live quota.
//!
//! Storage and HTTP traits are deliberately absent. With no I/O in this crate there
//! is nothing to abstract yet, and an interface with zero implementations is dead
//! weight. They arrive with the first route that needs them.

/// How long a cached value is fresh, and how long past that it may still be served
/// while a refresh happens in the background.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CachePolicy {
    pub ttl_secs: i64,
    pub stale_while_revalidate_secs: i64,
}

impl CachePolicy {
    #[must_use]
    pub const fn new(ttl_secs: i64, stale_while_revalidate_secs: i64) -> Self {
        Self {
            ttl_secs,
            stale_while_revalidate_secs,
        }
    }

    /// Past this age the value is gone and the caller must fetch before answering.
    #[must_use]
    pub const fn hard_expiry_secs(&self) -> i64 {
        self.ttl_secs + self.stale_while_revalidate_secs
    }

    /// The `Cache-Control` value a response served under this policy should carry.
    ///
    /// `stale-while-revalidate` is the part that matters: it lets the edge keep
    /// answering during a refresh instead of stampeding the upstream the moment the
    /// entry goes stale.
    #[must_use]
    pub fn cache_control(&self) -> String {
        format!(
            "public, max-age={}, stale-while-revalidate={}",
            self.ttl_secs, self.stale_while_revalidate_secs
        )
    }
}

/// A stored upstream response.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub body: String,
    /// Unix seconds.
    pub fetched_at: i64,
    pub etag: Option<String>,
}

/// What the cache can answer for a request at a given instant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Resolution {
    /// Serve it. Nothing to do in the background.
    Fresh,
    /// Serve it, and kick off a refresh.
    Stale,
    /// Nothing usable. The caller must fetch before it can answer.
    Miss,
}

/// Decide how to answer from a cached value.
///
/// Pure: no clock, no storage, no I/O. `now` is passed in, so every boundary is
/// testable without sleeping.
#[must_use]
pub fn resolve(entry: Option<&Entry>, policy: CachePolicy, now: i64) -> Resolution {
    let Some(entry) = entry else {
        return Resolution::Miss;
    };

    let age = now - entry.fetched_at;
    if age < 0 {
        // Clock skew: a row written by a machine running ahead of us. Refetching
        // until the clocks agree would turn one skew into a request flood, so treat
        // it as fresh and let it age out normally.
        return Resolution::Fresh;
    }

    if age < policy.ttl_secs {
        Resolution::Fresh
    } else if age < policy.hard_expiry_secs() {
        Resolution::Stale
    } else {
        Resolution::Miss
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 2 min fresh, then 10 min of stale-while-revalidate. 12 min hard expiry.
    const POLICY: CachePolicy = CachePolicy::new(120, 600);

    fn entry_at(fetched_at: i64) -> Entry {
        Entry {
            body: "{}".to_string(),
            fetched_at,
            etag: None,
        }
    }

    #[test]
    fn no_entry_is_a_miss() {
        assert_eq!(resolve(None, POLICY, 1_000), Resolution::Miss);
    }

    #[test]
    fn every_boundary_lands_on_the_right_side() {
        let e = entry_at(1_000);

        // Fresh: age < ttl
        assert_eq!(resolve(Some(&e), POLICY, 1_000), Resolution::Fresh, "age 0");
        assert_eq!(
            resolve(Some(&e), POLICY, 1_119),
            Resolution::Fresh,
            "age 119"
        );

        // Stale: ttl <= age < hard expiry — the ttl boundary is the important one
        assert_eq!(
            resolve(Some(&e), POLICY, 1_120),
            Resolution::Stale,
            "age 120 == ttl"
        );
        assert_eq!(
            resolve(Some(&e), POLICY, 1_719),
            Resolution::Stale,
            "age 719"
        );

        // Miss: age >= hard expiry
        assert_eq!(
            resolve(Some(&e), POLICY, 1_720),
            Resolution::Miss,
            "age 720 == hard expiry"
        );
        assert_eq!(
            resolve(Some(&e), POLICY, 99_999),
            Resolution::Miss,
            "long gone"
        );
    }

    #[test]
    fn clock_skew_reads_as_fresh_not_as_a_refetch_loop() {
        let future = entry_at(2_000);
        assert_eq!(resolve(Some(&future), POLICY, 1_000), Resolution::Fresh);
    }

    #[test]
    fn a_zero_ttl_policy_expires_immediately() {
        let policy = CachePolicy::new(0, 0);
        let e = entry_at(1_000);
        assert_eq!(resolve(Some(&e), policy, 1_000), Resolution::Miss);
        assert_eq!(policy.hard_expiry_secs(), 0);
    }

    #[test]
    fn cache_control_matches_the_policy() {
        assert_eq!(
            POLICY.cache_control(),
            "public, max-age=120, stale-while-revalidate=600"
        );
    }
}
