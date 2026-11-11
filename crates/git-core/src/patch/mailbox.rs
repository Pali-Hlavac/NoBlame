//! What a patch file holds: mails (`git format-patch` output, a mailbox `git am` makes commits
//! from) with their subjects and authors, or a plain diff (`git diff` output, which only
//! `git apply` takes), or nothing git could apply. Read in-process; only the start of very large
//! files is read.

use std::fs::File;
use std::io::Read;
use std::path::Path;

use super::PatchError;

/// How much of a patch file is read to say what it holds.
pub const MAX_PATCH_READ_BYTES: u64 = 64 * 1024 * 1024;

/// One mail of a mailbox: one commit for `git am`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatchMail {
    /// The subject without its `[PATCH 1/3]` tag: the commit's summary.
    pub subject: String,
    /// The author's name (or address when there is no name).
    pub author: String,
    /// Whether it holds changes (a cover letter does not; `git am` stops on it).
    pub has_diff: bool,
}

/// What a patch file holds.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PatchContents {
    /// Mails, in order.
    Mailbox(Vec<PatchMail>),
    /// A diff without a message.
    Diff,
    /// Nothing git could apply.
    NotAPatch,
}

/// Reads what the file at `path` holds (its first [`MAX_PATCH_READ_BYTES`]).
pub fn read_patch_file(path: &Path) -> Result<PatchContents, PatchError> {
    let mut bytes = Vec::new();
    File::open(path)
        .and_then(|file| file.take(MAX_PATCH_READ_BYTES).read_to_end(&mut bytes))
        .map_err(PatchError::io(path))?;
    Ok(parse_patch(&bytes))
}

fn is_header(line: &str) -> bool {
    let Some((name, _)) = line.split_once(':') else {
        return false;
    };
    !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// The `From <id> Mon Sep 17 00:00:00 2001` line starting a mail in a mailbox (it ends with a
/// year), not a message line that happens to start with "From".
fn is_from_line(line: &str) -> bool {
    line.strip_prefix("From ").is_some_and(|rest| {
        rest.split_whitespace()
            .last()
            .is_some_and(|year| year.len() == 4 && year.bytes().all(|b| b.is_ascii_digit()))
    })
}

fn is_diff_start(line: &str) -> bool {
    line.starts_with("diff --git ") || line.starts_with("+++ ") || line.starts_with("GIT binary")
}

/// What `bytes` (a patch file) holds.
pub fn parse_patch(bytes: &[u8]) -> PatchContents {
    let text = String::from_utf8_lossy(bytes);
    let lines: Vec<&str> = text.lines().collect();
    let Some(first) = lines.iter().position(|line| !line.trim().is_empty()) else {
        return PatchContents::NotAPatch;
    };
    let starts_mail = |at: usize| {
        is_from_line(lines[at]) && lines.get(at + 1).is_some_and(|next| is_header(next))
    };
    let mut starts: Vec<usize> = (first..lines.len()).filter(|&at| starts_mail(at)).collect();
    if starts.first() != Some(&first) && is_header(lines[first]) {
        // A single mail without the mailbox's `From ` line.
        starts.insert(0, first);
    }
    if starts.first() != Some(&first) {
        return if lines.iter().any(|line| is_diff_start(line)) {
            PatchContents::Diff
        } else {
            PatchContents::NotAPatch
        };
    }
    let ends = starts.iter().skip(1).copied().chain([lines.len()]);
    let mails = starts
        .iter()
        .zip(ends)
        .map(|(&start, end)| mail(&lines[start..end]))
        .collect();
    PatchContents::Mailbox(mails)
}

fn mail(lines: &[&str]) -> PatchMail {
    let skip = usize::from(lines.first().is_some_and(|line| is_from_line(line)));
    let mut headers: Vec<String> = Vec::new();
    let mut body = lines.len();
    for (index, line) in lines.iter().enumerate().skip(skip) {
        if line.trim().is_empty() {
            body = index;
            break;
        }
        match headers.last_mut() {
            // A folded header goes on.
            Some(last) if line.starts_with([' ', '\t']) => last.push_str(line),
            _ => headers.push((*line).to_owned()),
        }
    }
    let header = |name: &str| {
        headers.iter().find_map(|header| {
            let (key, value) = header.split_once(':')?;
            key.eq_ignore_ascii_case(name)
                .then(|| decode_header(value.trim()))
        })
    };
    PatchMail {
        subject: header("Subject").map_or_else(String::new, |subject| strip_tag(&subject)),
        author: header("From").map_or_else(String::new, |from| author_name(&from)),
        has_diff: lines[body..].iter().any(|line| is_diff_start(line)),
    }
}

/// `Fix it` from `[PATCH 2/3] Fix it` (any bracketed tag naming PATCH).
fn strip_tag(subject: &str) -> String {
    if let Some(rest) = subject.strip_prefix('[')
        && let Some((tag, after)) = rest.split_once(']')
        && tag.to_ascii_uppercase().contains("PATCH")
    {
        return after.trim().to_owned();
    }
    subject.to_owned()
}

/// `Ada Lovelace` from `Ada Lovelace <ada@example.com>` (or `"Lovelace, Ada" <…>`).
fn author_name(from: &str) -> String {
    match from.split_once('<') {
        Some((name, _)) if !name.trim().is_empty() => name.trim().trim_matches('"').to_owned(),
        Some((_, address)) => address.trim_end_matches('>').trim().to_owned(),
        None => from.trim().to_owned(),
    }
}

/// A header's value with its encoded words (`=?UTF-8?q?=C5=BDlu=C5=A5ou=C4=8Dk=C3=BD?=`)
/// decoded; space between two encoded words is dropped. UTF-8, ASCII and Latin-1, in Q or B
/// encoding; other words stay as they are.
pub fn decode_header(value: &str) -> String {
    let mut out = String::new();
    let mut rest = value;
    let mut after_word = false;
    while let Some(start) = rest.find("=?") {
        let (before, word) = rest.split_at(start);
        let decoded =
            encoded_word_end(word).and_then(|end| Some((decode_word(&word[..end])?, end)));
        let Some((text, end)) = decoded else {
            out.push_str(before);
            out.push_str("=?");
            rest = &word[2..];
            after_word = false;
            continue;
        };
        if !(after_word && before.trim().is_empty()) {
            out.push_str(before);
        }
        out.push_str(&text);
        rest = &word[end..];
        after_word = true;
    }
    out.push_str(rest);
    out
}

/// Where the encoded word at the start of `word` (`=?charset?enc?text?=`) ends.
fn encoded_word_end(word: &str) -> Option<usize> {
    let inner = &word[2..];
    let charset_end = inner.find('?')?;
    let encoding_end = charset_end + 1 + inner[charset_end + 1..].find('?')?;
    let text_end = encoding_end + 1 + inner[encoding_end + 1..].find("?=")?;
    Some(2 + text_end + 2)
}

fn decode_word(word: &str) -> Option<String> {
    let mut parts = word[2..word.len() - 2].splitn(3, '?');
    let charset = parts.next()?.to_ascii_lowercase();
    let encoding = parts.next()?.to_ascii_lowercase();
    let text = parts.next()?;
    let bytes = match encoding.as_str() {
        "q" => decode_q(text)?,
        "b" => decode_base64(text)?,
        _ => return None,
    };
    match charset.as_str() {
        "utf-8" | "utf8" | "us-ascii" => String::from_utf8(bytes).ok(),
        "iso-8859-1" | "latin1" => Some(bytes.into_iter().map(char::from).collect()),
        _ => None,
    }
}

fn hex(byte: u8) -> Option<u8> {
    char::from(byte)
        .to_digit(16)
        .and_then(|digit| u8::try_from(digit).ok())
}

fn decode_q(text: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(text.len());
    let mut bytes = text.bytes();
    while let Some(byte) = bytes.next() {
        match byte {
            b'_' => out.push(b' '),
            b'=' => out.push(hex(bytes.next()?)? * 16 + hex(bytes.next()?)?),
            other => out.push(other),
        }
    }
    Some(out)
}

fn decode_base64(text: &str) -> Option<Vec<u8>> {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::with_capacity(text.len() * 3 / 4);
    let (mut buffer, mut bits) = (0u32, 0u32);
    for byte in text.bytes().filter(|&byte| byte != b'=') {
        let value = ALPHABET.iter().position(|&c| c == byte)?;
        buffer = (buffer << 6) | u32::try_from(value).ok()?;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(u8::try_from((buffer >> bits) & 0xff).ok()?);
        }
    }
    Some(out)
}

#[cfg(test)]
#[path = "mailbox_tests.rs"]
mod tests;
