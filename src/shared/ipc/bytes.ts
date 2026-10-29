/** Raw binary command results (graph blocks, file contents). */
import { IPC_FAILURE, IpcError } from "./client";

/** Tauri delivers raw command results as an `ArrayBuffer` (or a view of one). */
export function toArrayBuffer(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  throw new IpcError(IPC_FAILURE, "Binary data arrived in an unexpected format.");
}
