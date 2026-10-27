//! Simulates a team's history: work on `main` and on topic branches, topic branches merged
//! back (sometimes as octopus merges), merged branches archived, tags on `main`.

use std::io::{self, Write};

use crate::people::signature;
use crate::rng::Rng;
use crate::spec::Spec;
use crate::stream::{CommitHeader, Mark, Stream};
use crate::tree::{content, path};

mod branches;

use branches::{Topic, topic_ref};

const MAIN_REF: &str = "refs/heads/main";
/// Percentage of non-merge commits that land directly on `main`.
const MAIN_COMMIT_PERCENT: u32 = 40;
/// A commit changes between 1 and this many files.
const MAX_FILES_PER_COMMIT: u32 = 3;
/// Time of the root commit (2008-01-10) and the gap between commits (on average ~8 minutes,
/// so a million commits span about 15 years).
const START_TIME: u64 = 1_200_000_000;
const MIN_GAP_SECS: u32 = 30;
const MAX_EXTRA_GAP_SECS: u32 = 900;

/// Counts of what was generated.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Summary {
    /// All commits, including merges.
    pub commits: u32,
    /// Merge commits (two or more parents).
    pub merges: u32,
    /// Merge commits with three parents.
    pub octopus_merges: u32,
    /// Local branches (`refs/heads/*`).
    pub branches: u32,
    /// Annotated tags.
    pub tags: u32,
}

/// Writes the whole history described by `spec` to `stream`.
pub fn write_history<W: Write>(spec: &Spec, stream: &mut Stream<W>) -> io::Result<Summary> {
    let mut sim = Simulation {
        spec,
        rng: Rng::new(spec.seed),
        stream,
        next_mark: 1,
        time: START_TIME,
        main_tip: 0,
        topics: Vec::new(),
        archived: Vec::new(),
        summary: Summary::default(),
    };
    sim.root()?;
    while sim.summary.commits < spec.commits {
        sim.step()?;
    }
    sim.finish()
}

struct Simulation<'a, W: Write> {
    spec: &'a Spec,
    rng: Rng,
    stream: &'a mut Stream<W>,
    next_mark: Mark,
    time: u64,
    main_tip: Mark,
    topics: Vec<Topic>,
    archived: Vec<(String, Mark)>,
    summary: Summary,
}

impl<W: Write> Simulation<'_, W> {
    fn root(&mut self) -> io::Result<()> {
        let mark = self.begin(MAIN_REF, "Initial commit\n", None, &[])?;
        for file in 0..self.spec.files {
            self.stream.modify(&path(file), &content(file, mark))?;
        }
        self.stream.end()?;
        self.main_tip = mark;
        self.topics = (0..self.spec.active_branches as usize)
            .map(|slot| Topic::fork(slot, mark))
            .collect();
        Ok(())
    }

    fn step(&mut self) -> io::Result<()> {
        let ready: Vec<usize> = (0..self.topics.len())
            .filter(|&index| self.topics[index].has_commits)
            .collect();
        if !ready.is_empty() && self.rng.percent(self.spec.merge_percent) {
            let first = ready[self.rng.below(len(&ready)) as usize];
            let octopus = ready.len() > 1 && self.rng.one_in(self.spec.octopus_one_in);
            let mut merged = vec![first];
            if octopus {
                merged.extend(ready.iter().copied().find(|&index| index != first));
            }
            return self.merge(&merged);
        }
        if self.topics.is_empty() || self.rng.percent(MAIN_COMMIT_PERCENT) {
            return self.commit_on_main();
        }
        let index = self.rng.below(len(&self.topics)) as usize;
        self.commit_on_topic(index)
    }

    fn commit_on_main(&mut self) -> io::Result<()> {
        let files = self.pick_files();
        let message = format!("Update {}\n", path(files[0]));
        let mark = self.begin(MAIN_REF, &message, Some(self.main_tip), &[])?;
        for &file in &files {
            self.stream.modify(&path(file), &content(file, mark))?;
        }
        self.stream.end()?;
        self.advance_main(mark)
    }

    fn commit_on_topic(&mut self, index: usize) -> io::Result<()> {
        let files = self.pick_files();
        let refname = topic_ref(self.topics[index].slot);
        let message = format!(
            "Work on {}\n\nTouches {} file(s).\n",
            path(files[0]),
            files.len()
        );
        let mark = self.begin(&refname, &message, Some(self.topics[index].tip), &[])?;
        for &file in &files {
            self.stream.modify(&path(file), &content(file, mark))?;
        }
        self.stream.end()?;
        let topic = &mut self.topics[index];
        topic.tip = mark;
        topic.has_commits = true;
        topic.changes.extend(files.iter().map(|&file| (file, mark)));
        Ok(())
    }

    fn advance_main(&mut self, mark: Mark) -> io::Result<()> {
        self.main_tip = mark;
        if self.spec.tag_every > 0 && self.summary.commits.is_multiple_of(self.spec.tag_every) {
            let number = self.summary.tags;
            let name = format!("v{}.{}.0", 1 + number / 20, number % 20);
            let tagger = signature(&mut self.rng, self.time);
            self.stream.tag(&name, mark, &tagger.as_signature())?;
            self.summary.tags += 1;
        }
        Ok(())
    }

    fn begin(
        &mut self,
        refname: &str,
        message: &str,
        from: Option<Mark>,
        merges: &[Mark],
    ) -> io::Result<Mark> {
        let mark = self.next_mark;
        self.next_mark += 1;
        self.time += u64::from(MIN_GAP_SECS + self.rng.below(MAX_EXTRA_GAP_SECS));
        let author = signature(&mut self.rng, self.time);
        let header = CommitHeader {
            refname,
            mark,
            author: &author.as_signature(),
            message,
            from,
            merges,
        };
        self.stream.commit(&header)?;
        self.summary.commits += 1;
        Ok(mark)
    }

    fn pick_files(&mut self) -> Vec<u32> {
        let count = 1 + self.rng.below(MAX_FILES_PER_COMMIT);
        let mut files: Vec<u32> = (0..count)
            .map(|_| self.rng.below(self.spec.files))
            .collect();
        files.sort_unstable();
        files.dedup();
        files
    }
}

pub(crate) fn len<T>(items: &[T]) -> u32 {
    u32::try_from(items.len()).unwrap_or(u32::MAX)
}
