//! Errors raised while building or reading the graph.

/// Failure while reading refs or history.
#[derive(Debug, thiserror::Error)]
pub enum GraphError {
    /// `gix` failed (corrupt objects, I/O, unsupported format, ...).
    #[error("{0}")]
    Gix(String),
    /// A row outside the graph was requested.
    #[error("row {row} is outside the graph ({rows} rows)")]
    RowOutOfRange {
        /// Requested row.
        row: u32,
        /// Rows in the graph.
        rows: u32,
    },
    /// No commit has this name or id.
    #[error("no commit is called \"{0}\"")]
    UnknownRevision(String),
    /// A newer request made the work pointless (a filter changed again while searching).
    #[error("cancelled")]
    Cancelled,
}

impl GraphError {
    /// Wraps a `gix` error.
    pub fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}
