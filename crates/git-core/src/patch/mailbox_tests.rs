use super::{PatchContents, PatchMail, decode_header, parse_patch};

const SERIES: &str = "From 8e83b8b8f084ba1ba82d6b21f831e1078fd63502 Mon Sep 17 00:00:00 2001
From: Ada Lovelace <ada@example.com>
Date: Tue, 10 Nov 2026 21:50:12 +0100
Subject: [PATCH 1/2] Change two

From now on the second line shouts.
Signed-off-by: Ada Lovelace <ada@example.com>
---
 f.txt | 2 +-

diff --git a/f.txt b/f.txt
--- a/f.txt
+++ b/f.txt
@@ -1,2 +1,2 @@
 one
-two
+TWO
--
2.56.0

From 1d4f0e7f2fb0c3b4f58a8e1f0a6a5f5f0e9b3c2a Mon Sep 17 00:00:00 2001
From: \"Lovelace, Ada\" <ada@example.com>
Subject: [PATCH 2/2] =?UTF-8?q?=C5=BDlu=C5=A5ou=C4=8Dk=C3=BD=20k=C5=AF?=
 =?UTF-8?q?=C5=88?=

---
diff --git a/g.txt b/g.txt
new file mode 100644
--- /dev/null
+++ b/g.txt
@@ -0,0 +1 @@
+new
";

#[test]
fn reads_the_mails_of_a_series() {
    let PatchContents::Mailbox(mails) = parse_patch(SERIES.as_bytes()) else {
        panic!("expected a mailbox");
    };
    assert_eq!(
        mails,
        vec![
            PatchMail {
                subject: "Change two".into(),
                author: "Ada Lovelace".into(),
                has_diff: true,
            },
            PatchMail {
                subject: "Žluťoučký kůň".into(),
                author: "Lovelace, Ada".into(),
                has_diff: true,
            },
        ]
    );
}

#[test]
fn a_mail_without_the_mailbox_line_and_with_crlf() {
    let mail = "From: Ada <ada@example.com>\r\nSubject: Fix it\r\n\r\nWhy.\r\n---\r\ndiff --git a/x b/x\r\n";
    assert_eq!(
        parse_patch(mail.as_bytes()),
        PatchContents::Mailbox(vec![PatchMail {
            subject: "Fix it".into(),
            author: "Ada".into(),
            has_diff: true,
        }])
    );
}

#[test]
fn a_cover_letter_has_no_changes() {
    let letter = "From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001\nFrom: Ada <a@b>\nSubject: [PATCH 0/2] *** SUBJECT HERE ***\n\n*** BLURB HERE ***\n";
    let PatchContents::Mailbox(mails) = parse_patch(letter.as_bytes()) else {
        panic!("expected a mailbox");
    };
    assert!(!mails[0].has_diff);
}

#[test]
fn plain_diffs_and_other_files() {
    let diff = "diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\n+b\n";
    assert_eq!(parse_patch(diff.as_bytes()), PatchContents::Diff);
    assert_eq!(parse_patch(b"just some notes\n"), PatchContents::NotAPatch);
    assert_eq!(parse_patch(b""), PatchContents::NotAPatch);
}

#[test]
fn decodes_encoded_words() {
    assert_eq!(decode_header("=?utf-8?b?xb1sdcWl?="), "Žluť");
    assert_eq!(decode_header("=?ISO-8859-1?Q?caf=E9_noir?="), "café noir");
    assert_eq!(
        decode_header("plain =?UTF-8?q?a?= =?UTF-8?q?b?= end"),
        "plain ab end"
    );
    // Unknown charsets and broken words stay as they are.
    assert_eq!(decode_header("=?koi8-r?q?x?="), "=?koi8-r?q?x?=");
    assert_eq!(decode_header("a =? b"), "a =? b");
}
