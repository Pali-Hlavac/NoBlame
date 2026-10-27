//! What to generate: the shape of a synthetic repository and the named presets.

/// Shape of a synthetic repository. The same spec always yields the same commit ids.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Spec {
    /// Total number of commits, including merges.
    pub commits: u32,
    /// Files in the tree (spread over directories of [`FILES_PER_DIR`] files).
    pub files: u32,
    /// Topic branches being worked on at the same time.
    pub active_branches: u32,
    /// Merged topic branches that keep a ref (`refs/heads/archive/*`), up to this many.
    pub archived_branches: u32,
    /// Percentage of steps that merge a topic branch into `main`.
    pub merge_percent: u32,
    /// One in this many merges is an octopus merge of two topics.
    pub octopus_one_in: u32,
    /// An annotated tag is created on `main` every this many commits.
    pub tag_every: u32,
    /// Also create `refs/remotes/origin/*` for every branch.
    pub remote_refs: bool,
    /// Seed of the random choices.
    pub seed: u64,
}

/// Files per directory in the generated tree.
pub const FILES_PER_DIR: u32 = 50;

/// Seed used by the presets.
pub const DEFAULT_SEED: u64 = 0x006E_6F62_6C61_6D65; // "noblame"

/// Named sizes used by `pnpm repos:generate` and the benchmarks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
pub enum Preset {
    /// 200 commits; for integration tests.
    Tiny,
    /// 10,000 commits.
    #[value(name = "10k")]
    Small,
    /// 100,000 commits.
    #[value(name = "100k")]
    Medium,
    /// 1,000,000 commits (several minutes, about 1 GB on disk).
    #[value(name = "1m")]
    Large,
}

impl Preset {
    /// Directory name used under the output folder.
    pub fn dir_name(self) -> &'static str {
        match self {
            Self::Tiny => "synthetic-tiny",
            Self::Small => "synthetic-10k",
            Self::Medium => "synthetic-100k",
            Self::Large => "synthetic-1m",
        }
    }

    /// The spec behind the preset.
    pub fn spec(self) -> Spec {
        let (commits, files, active, archived, tag_every) = match self {
            Self::Tiny => (200, 60, 3, 5, 40),
            Self::Small => (10_000, 2_000, 8, 200, 100),
            Self::Medium => (100_000, 10_000, 24, 2_000, 500),
            Self::Large => (1_000_000, 40_000, 64, 5_000, 1_000),
        };
        Spec {
            commits,
            files,
            active_branches: active,
            archived_branches: archived,
            merge_percent: 8,
            octopus_one_in: 50,
            tag_every,
            remote_refs: true,
            seed: DEFAULT_SEED,
        }
    }
}
