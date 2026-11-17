//! The saved workbench layout (docks, open tabs, sidebar size), persisted as one JSON document
//! in the platform app-config directory. The frontend owns the document's shape and version;
//! the backend only stores it. See `docs/design/workbench.md` and ADR 0020.

pub mod commands;

use serde::{Deserialize, Serialize};
use specta::datatype::DataType;
use specta::{Type, Types};
use tauri::{App, Manager};

use crate::storage::JsonFile;

/// File name of the layout document inside the app-config directory.
const LAYOUT_FILE_NAME: &str = "workbench-layout.json";

/// A layout as written by the frontend: any JSON value. Exported to TypeScript as `unknown`
/// (the frontend validates it), because specta refuses `serde_json::Value`'s 64-bit numbers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Layout(pub serde_json::Value);

impl Type for Layout {
    fn definition(types: &mut Types) -> DataType {
        <specta_typescript::Unknown as Type>::definition(types)
    }
}

/// The document on disk. `layout` is `None` until the UI saves one, and after a reset.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LayoutFile {
    /// The saved layout.
    pub layout: Option<Layout>,
}

/// Managed state holding the layout document.
pub type LayoutStore = JsonFile<LayoutFile>;

/// Registers a [`LayoutStore`] pointing at the platform config directory.
pub fn init(app: &App) -> tauri::Result<()> {
    let path = crate::storage::profile::config_dir(app)?.join(LAYOUT_FILE_NAME);
    app.manage(LayoutStore::new(path));
    Ok(())
}
