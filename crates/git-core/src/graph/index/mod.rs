//! A compact, immutable index of every commit reachable from the tips.
//!
//! Commits get dense `u32` indices in breadth-first discovery order. Parents are stored in one
//! flat array (CSR layout), times in another, so a million commits take about 40 bytes each.
//! The commit-graph file answers most lookups without decompressing objects; commits newer
//! than the file are read from the object database.

use std::collections::{HashMap, HashSet};

use gix::ObjectId;
use gix::commitgraph::{Graph as CommitGraph, Position};

use super::GraphError;

/// Marks an unassigned slot in `pos_to_idx`.
const UNASSIGNED: u32 = u32::MAX;

/// The commit DAG in compact form.
#[derive(Debug, Default)]
pub struct CommitIndex {
    ids: Vec<ObjectId>,
    times: Vec<i64>,
    parent_start: Vec<u32>,
    parents: Vec<u32>,
    /// Edges dropped because the parent object is not available (partial clones, corruption).
    pub missing_parents: usize,
}

impl CommitIndex {
    /// Number of commits.
    pub fn len(&self) -> usize {
        self.ids.len()
    }

    /// True when there are no commits (empty repository).
    pub fn is_empty(&self) -> bool {
        self.ids.is_empty()
    }

    /// Object id of commit `idx`.
    pub fn id(&self, idx: u32) -> &ObjectId {
        &self.ids[idx as usize]
    }

    /// Committer time of commit `idx`, in seconds since the epoch.
    pub fn time(&self, idx: u32) -> i64 {
        self.times[idx as usize]
    }

    /// Parent indices of commit `idx`, first parent first.
    pub fn parents(&self, idx: u32) -> &[u32] {
        let start = self.parent_start[idx as usize] as usize;
        let end = self.parent_start[idx as usize + 1] as usize;
        &self.parents[start..end]
    }

    /// Builds the index of all commits reachable from `tips`. Returns the index of each tip,
    /// or `None` for tips that are not commits (tags on trees or blobs, missing objects).
    pub fn build(
        repo: &gix::Repository,
        tips: &[ObjectId],
    ) -> Result<(Self, Vec<Option<u32>>), GraphError> {
        let mut builder = Builder::new(repo)?;
        let tip_indices = tips.iter().map(|id| builder.intern_tip(*id)).collect();
        builder.process_all()?;
        Ok((builder.finish(), tip_indices))
    }
}

struct Builder<'r> {
    repo: &'r gix::Repository,
    graph: Option<CommitGraph>,
    pos_to_idx: Vec<u32>,
    extra: HashMap<ObjectId, u32>,
    graph_pos: Vec<u32>,
    shallow: HashSet<ObjectId>,
    index: CommitIndex,
}

impl<'r> Builder<'r> {
    fn new(repo: &'r gix::Repository) -> Result<Self, GraphError> {
        // An unreadable commit-graph only costs speed, so fall back to the object database.
        let graph = repo.commit_graph_if_enabled().ok().flatten();
        let positions = graph
            .as_ref()
            .map_or(0, |graph| graph.num_commits() as usize);
        let shallow = repo
            .shallow_commits()
            .map_err(GraphError::gix)?
            .map(|commits| commits.iter().copied().collect())
            .unwrap_or_default();
        Ok(Self {
            repo,
            graph,
            pos_to_idx: vec![UNASSIGNED; positions],
            extra: HashMap::new(),
            graph_pos: Vec::new(),
            shallow,
            index: CommitIndex::default(),
        })
    }

    /// Interns a tip after checking that it is a commit.
    fn intern_tip(&mut self, id: ObjectId) -> Option<u32> {
        if let Some(pos) = self.graph.as_ref().and_then(|graph| graph.lookup(id)) {
            return Some(self.intern_graph(id, pos));
        }
        let is_commit = matches!(
            self.repo.try_find_header(id),
            Ok(Some(header)) if header.kind() == gix::object::Kind::Commit
        );
        is_commit.then(|| self.intern_extra(id))
    }

    fn intern_graph(&mut self, id: ObjectId, pos: Position) -> u32 {
        let slot = &mut self.pos_to_idx[pos.0 as usize];
        if *slot == UNASSIGNED {
            *slot = to_u32(self.index.ids.len());
            self.index.ids.push(id);
            self.graph_pos.push(pos.0);
        }
        *slot
    }

    fn intern_extra(&mut self, id: ObjectId) -> u32 {
        if let Some(idx) = self.extra.get(&id) {
            return *idx;
        }
        let idx = to_u32(self.index.ids.len());
        self.extra.insert(id, idx);
        self.index.ids.push(id);
        self.graph_pos.push(UNASSIGNED);
        idx
    }

    /// Visits commits in index order; parents discovered on the way get the next indices, so
    /// the parent array is written strictly in order.
    fn process_all(&mut self) -> Result<(), GraphError> {
        let mut next = 0;
        let mut parent_ids = Vec::new();
        while next < self.index.ids.len() {
            let id = self.index.ids[next];
            let pos = self.graph_pos[next];
            self.index
                .parent_start
                .push(to_u32(self.index.parents.len()));
            parent_ids.clear();
            let time = if pos == UNASSIGNED {
                self.read_object(id, &mut parent_ids)?
            } else {
                self.read_graph(pos, &mut parent_ids)?
            };
            self.index.times.push(time);
            if !self.shallow.contains(&id) {
                for parent in parent_ids.drain(..) {
                    match parent {
                        Parent::Graph(id, pos) => {
                            let idx = self.intern_graph(id, pos);
                            self.index.parents.push(idx);
                        }
                        Parent::Object(id) if self.repo.has_object(id) => {
                            let idx = self.intern_extra(id);
                            self.index.parents.push(idx);
                        }
                        Parent::Object(_) => self.index.missing_parents += 1,
                    }
                }
            }
            next += 1;
        }
        self.index
            .parent_start
            .push(to_u32(self.index.parents.len()));
        Ok(())
    }

    fn read_graph(&self, pos: u32, out: &mut Vec<Parent>) -> Result<i64, GraphError> {
        let graph = self
            .graph
            .as_ref()
            .ok_or_else(|| GraphError::Gix("commit-graph vanished".into()))?;
        let commit = graph.commit_at(Position(pos));
        for parent in commit.iter_parents() {
            let parent = parent.map_err(GraphError::gix)?;
            out.push(Parent::Graph(graph.id_at(parent).to_owned(), parent));
        }
        Ok(i64::try_from(commit.committer_timestamp()).unwrap_or(i64::MAX))
    }

    fn read_object(&self, id: ObjectId, out: &mut Vec<Parent>) -> Result<i64, GraphError> {
        let commit = self.repo.find_commit(id).map_err(GraphError::gix)?;
        for parent in commit.parent_ids() {
            let parent = parent.detach();
            let pos = self.graph.as_ref().and_then(|graph| graph.lookup(parent));
            out.push(pos.map_or(Parent::Object(parent), |pos| Parent::Graph(parent, pos)));
        }
        Ok(commit.time().map_err(GraphError::gix)?.seconds)
    }

    fn finish(self) -> CommitIndex {
        self.index
    }
}

enum Parent {
    Graph(ObjectId, Position),
    Object(ObjectId),
}

/// Commit counts fit in `u32` (Git itself limits commit-graph positions to 31 bits).
fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

#[cfg(test)]
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
