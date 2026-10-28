//! The walk that fills a [`CommitIndex`]: breadth-first from the tips, reading each commit from
//! the commit-graph file, the object database, or an earlier index.

use std::collections::{HashMap, HashSet};

use gix::ObjectId;
use gix::commitgraph::{Graph as CommitGraph, Position};

use super::{CommitIndex, to_u32};
use crate::graph::GraphError;

/// Marks an unassigned slot.
const UNASSIGNED: u32 = u32::MAX;

/// Where a commit's parents come from.
enum Source {
    /// Position in the commit-graph file.
    Graph(u32),
    /// The object database.
    Object,
    /// Index in the earlier index.
    Base(u32),
}

pub(super) struct Builder<'r> {
    repo: &'r gix::Repository,
    graph: Option<CommitGraph>,
    base: Option<&'r CommitIndex>,
    pos_to_idx: Vec<u32>,
    base_to_idx: Vec<u32>,
    extra: HashMap<ObjectId, u32>,
    sources: Vec<Source>,
    shallow: HashSet<ObjectId>,
    index: CommitIndex,
}

impl<'r> Builder<'r> {
    pub(super) fn new(
        repo: &'r gix::Repository,
        base: Option<&'r CommitIndex>,
    ) -> Result<Self, GraphError> {
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
            base,
            pos_to_idx: vec![UNASSIGNED; positions],
            base_to_idx: vec![UNASSIGNED; base.map_or(0, CommitIndex::len)],
            extra: HashMap::new(),
            sources: Vec::new(),
            shallow,
            index: CommitIndex::default(),
        })
    }

    /// Interns a tip after checking that it is a commit.
    pub(super) fn intern_tip(&mut self, id: ObjectId) -> Option<u32> {
        if let Some(known) = self.base.and_then(|base| base.lookup(&id)) {
            return Some(self.intern_base(known));
        }
        if let Some(pos) = self.graph.as_ref().and_then(|graph| graph.lookup(id)) {
            return Some(self.intern_graph(id, pos));
        }
        let is_commit = matches!(
            self.repo.try_find_header(id),
            Ok(Some(header)) if header.kind() == gix::object::Kind::Commit
        );
        is_commit.then(|| self.intern_extra(id))
    }

    /// Interns a parent read from the commit-graph or an object. Commits the earlier index
    /// knows are always interned through it, so no commit is interned twice.
    fn intern_parent(&mut self, id: ObjectId, pos: Option<Position>) -> Option<u32> {
        if let Some(known) = self.base.and_then(|base| base.lookup(&id)) {
            return Some(self.intern_base(known));
        }
        match pos {
            Some(pos) => Some(self.intern_graph(id, pos)),
            None if self.repo.has_object(id) => Some(self.intern_extra(id)),
            None => None,
        }
    }

    fn push(&mut self, id: ObjectId, source: Source) -> u32 {
        let idx = to_u32(self.index.ids.len());
        self.index.ids.push(id);
        self.sources.push(source);
        idx
    }

    fn intern_base(&mut self, known: u32) -> u32 {
        let slot = self.base_to_idx[known as usize];
        if slot != UNASSIGNED {
            return slot;
        }
        let id = self.base.map_or_else(
            || ObjectId::null(gix::hash::Kind::Sha1),
            |base| *base.id(known),
        );
        let idx = self.push(id, Source::Base(known));
        self.base_to_idx[known as usize] = idx;
        idx
    }

    fn intern_graph(&mut self, id: ObjectId, pos: Position) -> u32 {
        let slot = self.pos_to_idx[pos.0 as usize];
        if slot != UNASSIGNED {
            return slot;
        }
        let idx = self.push(id, Source::Graph(pos.0));
        self.pos_to_idx[pos.0 as usize] = idx;
        idx
    }

    fn intern_extra(&mut self, id: ObjectId) -> u32 {
        if let Some(idx) = self.extra.get(&id) {
            return *idx;
        }
        let idx = self.push(id, Source::Object);
        self.extra.insert(id, idx);
        idx
    }

    /// Visits commits in index order; parents discovered on the way get the next indices, so
    /// the parent array is written strictly in order.
    pub(super) fn process_all(&mut self) -> Result<(), GraphError> {
        let mut next = 0;
        let mut parents = Vec::new();
        while next < self.index.ids.len() {
            let id = self.index.ids[next];
            self.index
                .parent_start
                .push(to_u32(self.index.parents.len()));
            parents.clear();
            let time = match self.sources[next] {
                Source::Graph(pos) => self.read_graph(id, pos, &mut parents)?,
                Source::Object => self.read_object(id, &mut parents)?,
                Source::Base(known) => self.copy_base(known),
            };
            self.index.times.push(time);
            next += 1;
        }
        self.index
            .parent_start
            .push(to_u32(self.index.parents.len()));
        Ok(())
    }

    /// Copies a commit's time and parents from the earlier index.
    fn copy_base(&mut self, known: u32) -> i64 {
        let Some(base) = self.base else { return 0 };
        for &parent in base.parents(known) {
            let idx = self.intern_base(parent);
            self.index.parents.push(idx);
        }
        base.time(known)
    }

    fn read_graph(
        &mut self,
        id: ObjectId,
        pos: u32,
        out: &mut Vec<(ObjectId, Option<Position>)>,
    ) -> Result<i64, GraphError> {
        let graph = self
            .graph
            .as_ref()
            .ok_or_else(|| GraphError::Gix("commit-graph vanished".into()))?;
        let commit = graph.commit_at(Position(pos));
        for parent in commit.iter_parents() {
            let parent = parent.map_err(GraphError::gix)?;
            out.push((graph.id_at(parent).to_owned(), Some(parent)));
        }
        let time = i64::try_from(commit.committer_timestamp()).unwrap_or(i64::MAX);
        self.link_parents(id, out);
        Ok(time)
    }

    fn read_object(
        &mut self,
        id: ObjectId,
        out: &mut Vec<(ObjectId, Option<Position>)>,
    ) -> Result<i64, GraphError> {
        let commit = self.repo.find_commit(id).map_err(GraphError::gix)?;
        for parent in commit.parent_ids() {
            let parent = parent.detach();
            let pos = self.graph.as_ref().and_then(|graph| graph.lookup(parent));
            out.push((parent, pos));
        }
        let time = commit.time().map_err(GraphError::gix)?.seconds;
        self.link_parents(id, out);
        Ok(time)
    }

    /// Interns the parents in `out` (none past the shallow boundary) and records them.
    fn link_parents(&mut self, id: ObjectId, out: &mut Vec<(ObjectId, Option<Position>)>) {
        if self.shallow.contains(&id) {
            return;
        }
        for (parent, pos) in out.drain(..) {
            match self.intern_parent(parent, pos) {
                Some(idx) => self.index.parents.push(idx),
                None => self.index.missing_parents += 1,
            }
        }
    }

    pub(super) fn finish(self) -> CommitIndex {
        self.index
    }
}
