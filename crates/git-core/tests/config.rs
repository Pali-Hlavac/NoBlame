//! Reading, setting and removing the repository's own settings.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::cli::Git;
use git_core::config::{ConfigError, ConfigScope, read_config, set_config, unset_config};
use support::Fixture;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn local_settings_are_set_read_and_removed() {
    let fixture = Fixture::new();
    let (git, dir, cancel) = (
        Git::locate().unwrap(),
        fixture.path(),
        CancellationToken::new(),
    );
    let local = ConfigScope::Local;
    set_config(&git, &dir, local, "user.name", "Ada Lovelace", &cancel)
        .await
        .unwrap();
    // A value starting with "-" is a value, not an option.
    set_config(&git, &dir, local, "my.flag", "-x", &cancel)
        .await
        .unwrap();
    let file = read_config(&git, &dir, local, &cancel).await.unwrap();
    assert!(file.path.unwrap().ends_with("config"));
    let value = |key: &str| {
        file.entries
            .iter()
            .find(|e| e.key == key)
            .map(|e| e.value.clone())
    };
    assert_eq!(value("user.name").as_deref(), Some("Ada Lovelace"));
    assert_eq!(value("my.flag").as_deref(), Some("-x"));
    assert_eq!(fixture.git(&["config", "--local", "my.flag"]), "-x");

    unset_config(&git, &dir, local, "my.flag", &cancel)
        .await
        .unwrap();
    let file = read_config(&git, &dir, local, &cancel).await.unwrap();
    assert!(file.entries.iter().all(|entry| entry.key != "my.flag"));
    let bad = set_config(&git, &dir, local, "--global", "x", &cancel).await;
    assert!(matches!(bad, Err(ConfigError::InvalidKey(_))));
}
