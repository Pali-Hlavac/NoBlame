//! The built-in merge view of a conflicted file: its versions merged line by line, and saving
//! the result. What the commands take and return, and the service behind them.

use git_core::operation::{
    ChunkSource, MergeChunk, MergeFile, Unmergeable, merge_file, save_merged,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use tokio_util::sync::CancellationToken;

use super::error::OperationsError;
use super::service::{git, work_tree};
use crate::repository::{RepoId, RepoSessions, blocking};

/// Who changed resolved lines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ChunkSourceDto {
    /// Neither side.
    Unchanged,
    /// Only ours.
    Ours,
    /// Only theirs.
    Theirs,
    /// Both, in the same way.
    Both,
}

/// A run of lines of the merged file. Texts keep their line endings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MergeChunkDto {
    /// Lines the merge decided by itself.
    Resolved {
        source: ChunkSourceDto,
        text: String,
    },
    /// Lines both sides changed differently (`base` is empty where both added lines).
    Conflict {
        base: String,
        ours: String,
        theirs: String,
    },
}

/// Why a conflicted file cannot be merged in the view.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum UnmergeableDto {
    NoConflict,
    OneSided,
    NotAFile,
    Binary,
    NotUtf8,
    TooLarge,
    LargeFileStorage,
}

/// A conflicted file merged line by line, or why it cannot be.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MergeFileDto {
    /// The merged lines; `crlf` when most lines end in CRLF.
    Text {
        chunks: Vec<MergeChunkDto>,
        crlf: bool,
    },
    /// The view cannot merge it.
    Unavailable { reason: UnmergeableDto },
}

/// The merged file to save.
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SaveMergedRequestDto {
    pub path: String,
    /// The whole file (lines typed in the view end in `\n`).
    pub text: String,
    /// Give every line a CRLF ending (the file's own), as `get_merge_file` said.
    pub crlf: bool,
}

fn text(bytes: Vec<u8>) -> String {
    // The versions were checked to be UTF-8, so nothing is replaced.
    String::from_utf8(bytes)
        .unwrap_or_else(|error| String::from_utf8_lossy(error.as_bytes()).into_owned())
}

impl From<MergeChunk> for MergeChunkDto {
    fn from(chunk: MergeChunk) -> Self {
        match chunk {
            MergeChunk::Resolved {
                source,
                text: lines,
            } => Self::Resolved {
                source: match source {
                    ChunkSource::Unchanged => ChunkSourceDto::Unchanged,
                    ChunkSource::Ours => ChunkSourceDto::Ours,
                    ChunkSource::Theirs => ChunkSourceDto::Theirs,
                    ChunkSource::Both => ChunkSourceDto::Both,
                },
                text: text(lines),
            },
            MergeChunk::Conflict { base, ours, theirs } => Self::Conflict {
                base: text(base),
                ours: text(ours),
                theirs: text(theirs),
            },
        }
    }
}

impl From<Result<MergeFile, Unmergeable>> for MergeFileDto {
    fn from(merged: Result<MergeFile, Unmergeable>) -> Self {
        match merged {
            Ok(file) => Self::Text {
                chunks: file.chunks.into_iter().map(Into::into).collect(),
                crlf: file.crlf,
            },
            Err(reason) => Self::Unavailable {
                reason: match reason {
                    Unmergeable::NoConflict => UnmergeableDto::NoConflict,
                    Unmergeable::OneSided => UnmergeableDto::OneSided,
                    Unmergeable::NotAFile => UnmergeableDto::NotAFile,
                    Unmergeable::Binary => UnmergeableDto::Binary,
                    Unmergeable::NotUtf8 => UnmergeableDto::NotUtf8,
                    Unmergeable::TooLarge => UnmergeableDto::TooLarge,
                    Unmergeable::LargeFileStorage => UnmergeableDto::LargeFileStorage,
                },
            },
        }
    }
}

/// The conflicted `path` merged line by line.
pub async fn get(
    sessions: &RepoSessions,
    id: RepoId,
    path: String,
) -> Result<MergeFileDto, OperationsError> {
    let session = sessions.get(id)?;
    let repo = session.repo.clone();
    let merged = blocking(move || merge_file(&repo.local(), path.as_bytes())).await??;
    Ok(merged.into())
}

/// `text` with every line ending in CRLF (lines already ending in CRLF are kept).
fn with_crlf(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\n', "\r\n")
}

/// Saves the merged file: it is staged in place of the conflict and written to the working tree.
pub async fn save(
    sessions: &RepoSessions,
    id: RepoId,
    request: SaveMergedRequestDto,
) -> Result<(), OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let content = if request.crlf {
        with_crlf(&request.text)
    } else {
        request.text
    };
    let _writing = session.lock_writes().await;
    Ok(save_merged(
        &git,
        &dir,
        request.path.as_bytes(),
        content.as_bytes(),
        &CancellationToken::new(),
    )
    .await?)
}

#[cfg(test)]
mod tests {
    use super::with_crlf;

    #[test]
    fn gives_every_line_a_crlf_ending_once() {
        assert_eq!(with_crlf("a\r\nb\nc"), "a\r\nb\r\nc");
    }
}
