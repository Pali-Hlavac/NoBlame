//! Prints the licences of the syntax grammars and themes the diff colours with (two-face asks
//! for them to be acknowledged), as Markdown. Used by `pnpm licences`.
#![allow(clippy::print_stdout)]

fn main() {
    print!("{}", two_face::acknowledgement::listing().to_md());
}
