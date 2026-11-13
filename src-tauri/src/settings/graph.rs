//! Commit graph preferences: highlight, working tree rows, columns, how dates are shown and
//! whether the message's body is.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Commit graph preferences.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GraphSettings {
    /// Selecting a commit highlights its history and the commits by the same author.
    pub highlight_selection: bool,
    /// Where staged and unstaged changes are shown.
    pub working_tree: WorkingTreeDisplay,
    /// The columns in display order, shown or not, with their widths. The UI keeps the graph
    /// first and the message shown, ignores repeats and adds missing columns at the end.
    pub columns: Vec<GraphColumn>,
    /// Dates as a date and time, or as the time since ("3 h ago").
    pub date_display: DateDisplay,
    /// The message column shows the rest of the message, greyed, after the subject.
    pub show_message_body: bool,
}

/// Where the working tree changes (staged, unstaged, untracked, conflicted) are shown.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum WorkingTreeDisplay {
    /// Rows at the top of the commit graph, as Git Extensions does.
    #[default]
    Rows,
    /// A summary in the repository header.
    Header,
    /// Not shown.
    Hidden,
}

/// A column of the commit list.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum GraphColumnId {
    /// Lanes and commit nodes.
    Graph,
    /// Ref labels and the first line of the message.
    Message,
    /// Author name.
    Author,
    /// Author date.
    Date,
    /// Short commit id.
    Commit,
}

/// One column's place, visibility and width.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphColumn {
    /// Which column.
    pub id: GraphColumnId,
    /// Shown (the message is always shown).
    pub visible: bool,
    /// Width in pixels; unset (`null`) for the default: the graph fits its lanes, the message
    /// always takes the rest.
    pub width: Option<u32>,
}

/// How dates are shown in the commit list.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DateDisplay {
    /// Date and time.
    #[default]
    Absolute,
    /// Time since, like "3 h ago" (the date and time in the tooltip).
    Relative,
}

impl Default for GraphSettings {
    fn default() -> Self {
        let column = |id| GraphColumn {
            id,
            visible: true,
            width: None,
        };
        Self {
            highlight_selection: true,
            working_tree: WorkingTreeDisplay::default(),
            columns: [
                GraphColumnId::Graph,
                GraphColumnId::Message,
                GraphColumnId::Author,
                GraphColumnId::Date,
                GraphColumnId::Commit,
            ]
            .map(column)
            .to_vec(),
            date_display: DateDisplay::default(),
            show_message_body: false,
        }
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;

    #[test]
    fn saved_columns_keep_their_order_and_widths() {
        let settings: GraphSettings = serde_json::from_str(
            r#"{ "columns": [{ "id": "date", "visible": true, "width": 90 }],
                 "dateDisplay": "relative" }"#,
        )
        .unwrap();
        assert_eq!(
            settings.columns,
            [GraphColumn {
                id: GraphColumnId::Date,
                visible: true,
                width: Some(90),
            }]
        );
        assert_eq!(settings.date_display, DateDisplay::Relative);
        assert!(settings.highlight_selection);
    }
}
