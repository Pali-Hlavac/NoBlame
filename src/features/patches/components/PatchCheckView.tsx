import { AlertTriangleIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";

import type { ApplyModeDto, PatchCheckDto, PatchFileDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { fitText } from "../lib/patches";

/** Mails listed per file; the rest are counted. */
const SHOWN_MAILS = 20;
/** Changed files listed; the rest are counted. */
const SHOWN_PATHS = 40;

const TONES = {
  ok: { icon: CheckCircle2Icon, className: "text-success" },
  warn: { icon: AlertTriangleIcon, className: "text-warning" },
  error: { icon: XCircleIcon, className: "text-destructive" },
} as const;

function FileContents({ file }: { file: PatchFileDto }) {
  const { contents } = file;
  if (contents.kind === "diff") {
    return <p className="text-xs text-muted-foreground">A diff without a message</p>;
  }
  if (contents.kind === "notAPatch") {
    return <p className="text-xs text-destructive">Not a patch: git finds no changes in it</p>;
  }
  const more = contents.mails.length - SHOWN_MAILS;
  return (
    <ul className="text-xs text-muted-foreground">
      {contents.mails.slice(0, SHOWN_MAILS).map((mail, index) => (
        <li key={index} className="truncate">
          {mail.subject || "(no subject)"}
          {mail.author ? ` · ${mail.author}` : ""}
          {mail.hasDiff ? "" : " · no changes (git am stops on it)"}
        </li>
      ))}
      {more > 0 ? <li>and {more.toLocaleString()} more</li> : null}
    </ul>
  );
}

/** The chosen files with their mails, whether they apply, and the files they change. */
export function PatchCheckView({ check, mode }: { check: PatchCheckDto; mode: ApplyModeDto }) {
  const fit = fitText(check.fit, mode);
  const Tone = TONES[fit.tone];
  const more = check.totalPaths - Math.min(check.paths.length, SHOWN_PATHS);
  return (
    <div className="flex min-w-0 flex-col gap-3 text-sm">
      <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
        {check.files.map((file) => (
          <li key={file.path} className="min-w-0">
            <span className="block truncate font-medium" title={file.path}>
              {file.name}
            </span>
            <FileContents file={file} />
          </li>
        ))}
      </ul>
      <div className={cn("flex items-start gap-2", Tone.className)} role="status">
        <Tone.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{fit.text}</span>
      </div>
      {check.fit.kind === "fails" ? (
        <pre className="max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
          {check.fit.message}
        </pre>
      ) : null}
      {check.totalPaths > 0 ? (
        <div className="min-w-0">
          <p className="font-medium">
            Changes {check.totalPaths.toLocaleString()} {check.totalPaths === 1 ? "file" : "files"}
          </p>
          <ul className="max-h-32 overflow-y-auto font-mono text-xs">
            {check.paths.slice(0, SHOWN_PATHS).map((path) => (
              <li key={path.path} className="flex gap-2">
                <span className="min-w-0 flex-1 truncate" title={path.path}>
                  {path.path}
                </span>
                {path.added === null ? (
                  <span className="text-muted-foreground">binary</span>
                ) : (
                  <span>
                    <span className="text-success">+{path.added}</span>{" "}
                    <span className="text-destructive">−{path.removed}</span>
                  </span>
                )}
              </li>
            ))}
            {more > 0 ? (
              <li className="text-muted-foreground">and {more.toLocaleString()} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
