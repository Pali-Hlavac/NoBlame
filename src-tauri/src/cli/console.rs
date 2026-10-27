//! Making `--help`, `--version` and usage errors visible.
//!
//! Release builds on Windows are GUI-subsystem programs without a console, so their output
//! would vanish. Attaching to the console of the parent process (the terminal that started
//! `noblame`) makes it appear there.

/// Attaches to the parent's console on Windows; a no-op elsewhere and when there is none.
#[cfg(windows)]
#[allow(unsafe_code)]
pub fn attach_parent_console() {
    use windows_sys::Win32::System::Console::{ATTACH_PARENT_PROCESS, AttachConsole};
    // SAFETY: `AttachConsole` has no memory-safety preconditions. It fails harmlessly when
    // the process already has a console or the parent has none, so the result is ignored.
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

/// Attaches to the parent's console on Windows; a no-op elsewhere and when there is none.
#[cfg(not(windows))]
pub fn attach_parent_console() {}
