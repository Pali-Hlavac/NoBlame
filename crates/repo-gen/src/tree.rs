//! Paths and file contents of the generated tree.

use crate::spec::FILES_PER_DIR;
use crate::stream::Mark;

/// Path of file number `file`, grouped into directories.
pub(crate) fn path(file: u32) -> String {
    format!("src/m{:04}/f{file:05}.txt", file / FILES_PER_DIR)
}

/// Content of `file` as last changed by commit `revision`; unique per revision.
pub(crate) fn content(file: u32, revision: Mark) -> Vec<u8> {
    format!(
        "{}\nrevision {revision}\n\nfn item_{file}() -> u32 {{ {revision} }}\n",
        path(file)
    )
    .into_bytes()
}
