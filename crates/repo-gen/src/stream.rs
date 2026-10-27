//! Writing commands in the `git fast-import` stream format.
//! Reference: <https://git-scm.com/docs/git-fast-import>.

use std::io::{self, Write};

/// A mark (`:n`) naming a commit inside the stream.
pub type Mark = u32;

/// Identity and time of an author or committer.
pub struct Signature<'a> {
    /// Display name (may contain non-ASCII characters).
    pub name: &'a str,
    /// E-mail address.
    pub email: &'a str,
    /// Seconds since the Unix epoch.
    pub time: u64,
}

/// Everything about one commit except its file changes.
pub struct CommitHeader<'a> {
    /// Full ref the commit is created on, e.g. `refs/heads/main`.
    pub refname: &'a str,
    /// Mark assigned to the new commit.
    pub mark: Mark,
    /// Author and committer.
    pub author: &'a Signature<'a>,
    /// Commit message.
    pub message: &'a str,
    /// First parent, if any.
    pub from: Option<Mark>,
    /// Further parents (merges).
    pub merges: &'a [Mark],
}

/// Fast-import command writer over any byte sink (usually the stdin of `git fast-import`).
pub struct Stream<W: Write> {
    out: W,
}

impl<W: Write> Stream<W> {
    /// Wraps a writer.
    pub fn new(out: W) -> Self {
        Self { out }
    }

    /// Starts a commit; follow it with [`modify`](Self::modify) calls and [`end`](Self::end).
    pub fn commit(&mut self, header: &CommitHeader<'_>) -> io::Result<()> {
        let CommitHeader {
            refname,
            mark,
            author,
            message,
            from,
            merges,
        } = header;
        writeln!(self.out, "commit {refname}\nmark :{mark}")?;
        for role in ["author", "committer"] {
            writeln!(
                self.out,
                "{role} {} <{}> {} +0000",
                author.name, author.email, author.time
            )?;
        }
        self.data(message.as_bytes())?;
        if let Some(from) = from {
            writeln!(self.out, "from :{from}")?;
        }
        for merge in *merges {
            writeln!(self.out, "merge :{merge}")?;
        }
        Ok(())
    }

    /// Sets the content of `path` in the commit being written.
    pub fn modify(&mut self, path: &str, content: &[u8]) -> io::Result<()> {
        writeln!(self.out, "M 100644 inline {path}")?;
        self.data(content)
    }

    /// Ends the commit being written.
    pub fn end(&mut self) -> io::Result<()> {
        writeln!(self.out)
    }

    /// Points `refname` at the commit `mark` (creating or moving the ref).
    pub fn reset(&mut self, refname: &str, mark: Mark) -> io::Result<()> {
        writeln!(self.out, "reset {refname}\nfrom :{mark}\n")
    }

    /// Creates an annotated tag `name` on `mark`.
    pub fn tag(&mut self, name: &str, mark: Mark, tagger: &Signature<'_>) -> io::Result<()> {
        writeln!(self.out, "tag {name}\nfrom :{mark}")?;
        writeln!(
            self.out,
            "tagger {} <{}> {} +0000",
            tagger.name, tagger.email, tagger.time
        )?;
        // Unlike `commit` and `reset`, `tag` has no optional trailing LF after its data.
        self.data(format!("Release {name}\n").as_bytes())
    }

    /// Terminates the stream (`--done` mode) and returns the writer.
    pub fn finish(mut self) -> io::Result<W> {
        writeln!(self.out, "done")?;
        self.out.flush()?;
        Ok(self.out)
    }

    fn data(&mut self, bytes: &[u8]) -> io::Result<()> {
        writeln!(self.out, "data {}", bytes.len())?;
        self.out.write_all(bytes)?;
        writeln!(self.out)
    }
}
