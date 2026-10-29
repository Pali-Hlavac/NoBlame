//! Raw binary command results. Tauri delivers them to the webview as an `ArrayBuffer`
//! without JSON encoding; the generated TypeScript type is `unknown`, narrowed by the client.

use specta::datatype::DataType;
use specta::{Type, Types};
use tauri::ipc::{InvokeResponseBody, IpcResponse};

/// Bytes returned as-is (an encoded graph block, a file's contents).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawBytes(pub Vec<u8>);

impl IpcResponse for RawBytes {
    fn body(self) -> tauri::Result<InvokeResponseBody> {
        Ok(InvokeResponseBody::Raw(self.0))
    }
}

impl Type for RawBytes {
    fn definition(types: &mut Types) -> DataType {
        <specta_typescript::Unknown as Type>::definition(types)
    }
}
