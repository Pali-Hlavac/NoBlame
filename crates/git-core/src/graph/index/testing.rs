//! Building a `CommitIndex` without a repository, for unit tests.

use gix::ObjectId;

use super::{CommitIndex, to_u32};

impl CommitIndex {
    /// An index without a repository: commit `i` has time `times[i]` and parents `parents[i]`.
    pub(crate) fn from_parents(times: &[i64], parents: &[&[u32]]) -> Self {
        let mut index = Self {
            ids: vec![ObjectId::null(gix::hash::Kind::Sha1); times.len()],
            times: times.to_vec(),
            ..Self::default()
        };
        for list in parents {
            index.parent_start.push(to_u32(index.parents.len()));
            index.parents.extend_from_slice(list);
        }
        index.parent_start.push(to_u32(index.parents.len()));
        index
    }
}
