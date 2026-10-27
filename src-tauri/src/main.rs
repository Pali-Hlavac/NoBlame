//! Binary entry point: parses the command line, then starts (or forwards to) the app.
//! Release builds on Windows are GUI programs, so no console window appears.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use noblame_lib::cli;

fn main() {
    let cwd = std::env::current_dir().unwrap_or_default();
    match cli::parse(std::env::args_os(), &cwd) {
        Ok(request) => noblame_lib::run(request),
        // `--help`, `--version` and usage errors: print them where the user typed the command.
        Err(error) => {
            cli::attach_parent_console();
            // Printing can only fail when there is no console at all; nothing more to do then.
            let _ = error.print();
            std::process::exit(error.exit_code());
        }
    }
}
