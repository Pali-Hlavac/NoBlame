import tauriConfig from "../src-tauri/tauri.conf.json";

import { APP_NAME, CLI_NAME } from "./app.config";

describe("app config", () => {
  it("keeps the product and binary names in sync with tauri.conf.json", () => {
    expect(tauriConfig.productName).toBe(APP_NAME);
    expect(tauriConfig.mainBinaryName).toBe(CLI_NAME);
  });

  it("creates every window from Rust, so none are declared in the config", () => {
    expect(tauriConfig.app.windows).toEqual([]);
  });
});
