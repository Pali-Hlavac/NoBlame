//! Killing a git process together with everything it started (`ssh`, credential helpers, `sh`
//! running an alias, `git-remote-https`), which killing the direct child alone leaves running.
//!
//! - Windows: the child is put in a job object right after it starts; its children join the
//!   job automatically, and `TerminateJobObject` ends all of them.
//! - Unix: the child leads a new process group (`process_group(0)`), which its children
//!   inherit; `kill(-pgid, SIGKILL)` ends all of them.
//!
//! The tree is killed when the run is cancelled or dropped before it finished. After a normal
//! exit nothing is killed: helpers that git meant to outlive it (an ssh control master) stay.

use tokio::process::{Child, Command};

/// Prepares `command` so that its process tree can be killed (Unix: a new process group).
pub(super) fn prepare(command: &mut Command) {
    #[cfg(unix)]
    command.process_group(0);
    #[cfg(not(unix))]
    let _ = command;
}

/// The process tree of one running child. Dropping it before [`finish`](Self::finish) kills
/// the whole tree.
pub(super) struct ProcessTree {
    #[cfg(windows)]
    job: Option<windows::Job>,
    #[cfg(unix)]
    group: Option<rustix::process::Pid>,
    finished: bool,
}

impl ProcessTree {
    /// Takes hold of `child`'s tree. When that fails (Windows: the app's own job forbids
    /// nesting, very old systems) only the direct child is killed, as before.
    pub(super) fn attach(child: &Child) -> Self {
        #[cfg(windows)]
        {
            let job = child.raw_handle().and_then(windows::Job::with_process);
            if job.is_none() {
                tracing::warn!("could not put git in a job object; only git itself is killed");
            }
            Self {
                job,
                finished: false,
            }
        }
        #[cfg(unix)]
        {
            let group = child
                .id()
                .and_then(|id| i32::try_from(id).ok())
                .and_then(rustix::process::Pid::from_raw);
            Self {
                group,
                finished: false,
            }
        }
        #[cfg(not(any(windows, unix)))]
        {
            let _ = child;
            Self { finished: false }
        }
    }

    /// The child exited by itself: leave whatever it left running.
    pub(super) fn finish(&mut self) {
        self.finished = true;
    }

    fn kill(&self) {
        #[cfg(windows)]
        if let Some(job) = &self.job {
            job.terminate();
        }
        #[cfg(unix)]
        if let Some(group) = self.group {
            // The group may be gone already (everything exited); nothing to report then.
            let _ = rustix::process::kill_process_group(group, rustix::process::Signal::KILL);
        }
    }
}

impl Drop for ProcessTree {
    fn drop(&mut self) {
        if !self.finished {
            self.kill();
        }
    }
}

#[cfg(windows)]
#[allow(unsafe_code)]
mod windows {
    use std::os::windows::io::RawHandle;

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, TerminateJobObject,
    };

    /// Exit code given to the processes of a cancelled job.
    const CANCELLED_EXIT_CODE: u32 = 1;

    /// An owned, unnamed job object handle.
    pub(super) struct Job(HANDLE);

    // SAFETY: a job object handle is a kernel handle usable from any thread; this type owns it
    // exclusively and only passes it to thread-safe Win32 functions.
    unsafe impl Send for Job {}
    // SAFETY: as above; `terminate` takes `&self` and `TerminateJobObject` is thread-safe.
    unsafe impl Sync for Job {}

    impl Job {
        /// A new job holding `process`, or `None` when either step fails.
        pub(super) fn with_process(process: RawHandle) -> Option<Self> {
            // SAFETY: null attributes and a null name are allowed (default security, unnamed).
            let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if handle.is_null() {
                return None;
            }
            let job = Self(handle);
            // SAFETY: both handles are valid: `job` was just created, `process` belongs to a
            // child that has not been waited for yet (the caller holds it).
            let assigned = unsafe { AssignProcessToJobObject(job.0, process) };
            (assigned != 0).then_some(job)
        }

        /// Ends every process in the job.
        pub(super) fn terminate(&self) {
            // SAFETY: the handle is valid until `drop`.
            unsafe {
                TerminateJobObject(self.0, CANCELLED_EXIT_CODE);
            }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            // SAFETY: the handle is owned and closed exactly once. Closing it does not end the
            // processes (no kill-on-close limit is set).
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}
