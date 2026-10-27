//! Topic branches: forking from `main`, merging back (sometimes as octopus merges), archiving
//! merged branches, and the final refs.

use std::collections::BTreeMap;
use std::io::{self, Write};

use super::{MAIN_REF, Simulation, Summary};
use crate::stream::Mark;
use crate::tree::{content, path};

/// A topic branch being worked on in one of the active slots.
pub(super) struct Topic {
    pub(super) slot: usize,
    /// First parent of the topic's next commit: the fork point, then its own tip.
    pub(super) tip: Mark,
    /// Whether the topic has commits of its own since it forked from `main`.
    pub(super) has_commits: bool,
    /// Files changed on the topic and the mark of the commit that last changed them.
    pub(super) changes: BTreeMap<u32, Mark>,
}

impl Topic {
    pub(super) fn fork(slot: usize, base: Mark) -> Self {
        Self {
            slot,
            tip: base,
            has_commits: false,
            changes: BTreeMap::new(),
        }
    }
}

impl<W: Write> Simulation<'_, W> {
    /// Merges the topics at `indices` into `main`; the result keeps the topics' changes.
    pub(super) fn merge(&mut self, indices: &[usize]) -> io::Result<()> {
        let names: Vec<String> = indices
            .iter()
            .map(|&i| topic_name(self.topics[i].slot))
            .collect();
        let tips: Vec<Mark> = indices.iter().map(|&i| self.topics[i].tip).collect();
        let message = format!("Merge branches '{}'\n", names.join("', '"));
        let mark = self.begin(MAIN_REF, &message, Some(self.main_tip), &tips)?;
        for &index in indices {
            for (&file, &rev) in &self.topics[index].changes {
                self.stream.modify(&path(file), &content(file, rev))?;
            }
        }
        self.stream.end()?;
        self.summary.merges += 1;
        if indices.len() > 1 {
            self.summary.octopus_merges += 1;
        }
        for (&index, tip) in indices.iter().zip(tips) {
            self.archive(tip)?;
            self.topics[index] = Topic::fork(self.topics[index].slot, mark);
        }
        self.advance_main(mark)
    }

    fn archive(&mut self, tip: Mark) -> io::Result<()> {
        if self.archived.len() < self.spec.archived_branches as usize {
            let name = format!("feature/{:05}", self.archived.len() + 1);
            self.stream.reset(&format!("refs/heads/{name}"), tip)?;
            self.archived.push((name, tip));
        }
        Ok(())
    }

    pub(super) fn finish(self) -> io::Result<Summary> {
        let mut heads: Vec<(String, Mark)> = vec![("main".to_owned(), self.main_tip)];
        heads.extend(
            self.topics
                .iter()
                .filter(|t| t.has_commits)
                .map(|t| (topic_name(t.slot), t.tip)),
        );
        heads.extend(self.archived.iter().cloned());
        if self.spec.remote_refs {
            for (name, mark) in &heads {
                self.stream
                    .reset(&format!("refs/remotes/origin/{name}"), *mark)?;
            }
        }
        // Slots that never got a commit still have a ref at the root; count every slot.
        let slots = self.topics.len();
        Ok(Summary {
            branches: u32::try_from(1 + slots + self.archived.len()).unwrap_or(u32::MAX),
            ..self.summary
        })
    }
}

pub(super) fn topic_name(slot: usize) -> String {
    format!("topic/{slot:02}")
}

pub(super) fn topic_ref(slot: usize) -> String {
    format!("refs/heads/{}", topic_name(slot))
}
