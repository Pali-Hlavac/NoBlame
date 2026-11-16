import { type ReactNode, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { changeCommitLayout, useCommitLayout } from "../store/layout";

/** A list keeps its header and a row or two. */
const LIST_MIN_HEIGHT = "56px";
/** Panels must not scroll (see `Workbench.tsx`); the lists scroll themselves. */
const PANEL_STYLE = { overflow: "hidden" } as const;

/** Changes above Staged, with a splitter between them whose position is remembered. */
export function ListsSplit({ changes, staged }: { changes: ReactNode; staged: ReactNode }) {
  // Read once: the splitter would reset on every drag step if it followed the store.
  const [defaultLayout] = useState(() => useCommitLayout.getState().lists ?? undefined);
  return (
    <Group
      orientation="vertical"
      className="h-full"
      defaultLayout={defaultLayout}
      onLayoutChanged={(lists) => {
        changeCommitLayout({ lists });
      }}
    >
      <Panel id="changes" minSize={LIST_MIN_HEIGHT} style={PANEL_STYLE}>
        {changes}
      </Panel>
      <Separator
        aria-label="Resize the Changes and Staged lists"
        className="h-px bg-border outline-none hover:bg-primary focus-visible:bg-ring data-[separator=active]:bg-primary"
      />
      <Panel id="staged" minSize={LIST_MIN_HEIGHT} style={PANEL_STYLE}>
        {staged}
      </Panel>
    </Group>
  );
}
