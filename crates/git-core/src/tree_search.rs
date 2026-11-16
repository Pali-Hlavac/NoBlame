//! Searching the files of a revision: the entries of a whole tree whose path holds every word of
//! a query, with the folders leading to them, in the order the Files module shows a tree. The
//! tree is read in-process with gix, one folder at a time, and the walk stops after
//! [`MAX_SEARCH_MATCHES`] matches.

use gix::ObjectId;
use gix::bstr::{BStr, BString, ByteSlice};

use crate::tree::{TreeEntry, TreeEntryKind, TreeError, list_tree};

/// Matching entries found at most; the search then stops and says it is incomplete.
pub const MAX_SEARCH_MATCHES: usize = 2_000;

/// One row of a search result: a match, or a folder on the way to one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TreeSearchRow {
    /// Path from the root, `/`-separated. Bytes: may be non-UTF-8.
    pub path: BString,
    /// Folders above it (0 at the root).
    pub depth: u32,
    /// The entry itself.
    pub entry: TreeEntry,
    /// Its path holds every word (folders on the way to a match may not).
    pub matched: bool,
}

/// What a search found.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct TreeSearch {
    /// Matches and the folders leading to them, folders first, by name (as a tree shows them).
    pub rows: Vec<TreeSearchRow>,
    /// Matching entries listed.
    pub matches: usize,
    /// Every folder was searched (false when the search stopped at the limit).
    pub complete: bool,
}

/// The words of `query`, lower case; matching ignores case.
fn words(query: &str) -> Vec<String> {
    query.split_whitespace().map(str::to_lowercase).collect()
}

/// Every word is somewhere in `path`, ignoring case.
fn holds_all(path: &BStr, words: &[String]) -> bool {
    let path = path.to_str_lossy().to_lowercase();
    words.iter().all(|word| path.contains(word.as_str()))
}

struct Walk<'a> {
    repo: &'a gix::Repository,
    words: Vec<String>,
    found: TreeSearch,
}

impl Walk<'_> {
    /// Adds the rows of folder `tree` (at `prefix`, `depth`) that lead to matches; true when any.
    fn visit(&mut self, tree: ObjectId, prefix: &BStr, depth: u32) -> Result<bool, TreeError> {
        let listing = list_tree(self.repo, tree)?;
        let mut any = false;
        for entry in listing.entries {
            if self.found.matches >= MAX_SEARCH_MATCHES {
                self.found.complete = false;
                break;
            }
            let mut path = BString::from(prefix);
            if !path.is_empty() {
                path.push(b'/');
            }
            path.extend_from_slice(&entry.name);
            let matched = holds_all(path.as_ref(), &self.words);
            let folder = entry.kind == TreeEntryKind::Folder;
            let at = self.found.rows.len();
            let id = entry.id;
            self.found.rows.push(TreeSearchRow {
                path: path.clone(),
                depth,
                entry,
                matched,
            });
            if matched {
                self.found.matches += 1;
            }
            let inside = folder && self.visit(id, path.as_ref(), depth + 1)?;
            if matched || inside {
                any = true;
            } else {
                // Neither it nor anything in it matched: not on the way to a match.
                self.found.rows.truncate(at);
            }
        }
        Ok(any)
    }
}

/// The entries of tree `root` whose path holds every word of `query` (ignoring case), with the
/// folders leading to them. An empty query finds nothing. Blocking: reads every folder until
/// [`MAX_SEARCH_MATCHES`] entries matched.
pub fn search_tree(
    repo: &gix::Repository,
    root: ObjectId,
    query: &str,
) -> Result<TreeSearch, TreeError> {
    let words = words(query);
    if words.is_empty() {
        return Ok(TreeSearch {
            complete: true,
            ..TreeSearch::default()
        });
    }
    let mut walk = Walk {
        repo,
        words,
        found: TreeSearch {
            complete: true,
            ..TreeSearch::default()
        },
    };
    walk.visit(root, BStr::new(b""), 0)?;
    Ok(walk.found)
}
