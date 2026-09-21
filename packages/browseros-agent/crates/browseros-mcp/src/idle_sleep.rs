//! Hold an IOPM idle-sleep assertion while a tool runs so long agent turns
//! do not let the Mac sleep mid-task.

use std::process::Child;
#[cfg(target_os = "macos")]
use std::process::{Command, Stdio};

pub struct IdleSleepGuard {
    child: Option<Child>,
}

impl Drop for IdleSleepGuard {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// `caffeinate -i` creates an IOPM `PreventUserIdleSystemSleep` assertion
/// for this process. Fail-open if the binary is missing.
#[must_use]
pub fn hold() -> IdleSleepGuard {
    #[cfg(target_os = "macos")]
    {
        let child = Command::new("caffeinate")
            .arg("-i")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .ok();
        return IdleSleepGuard { child };
    }
    #[cfg(not(target_os = "macos"))]
    IdleSleepGuard { child: None }
}
