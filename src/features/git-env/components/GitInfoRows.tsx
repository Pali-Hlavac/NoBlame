import { useGitInfo } from "../api/gitInfo";
import { describeGitStatus } from "../lib/gitStatus";

/** `<dt>/<dd>` rows describing git, for definition lists such as the About dialog. */
export function GitInfoRows() {
  const query = useGitInfo();
  const { data } = query;
  const status = describeGitStatus(query);

  if (!data) {
    return (
      <>
        <dt className="text-muted-foreground">Git</dt>
        <dd>{status.detail}</dd>
      </>
    );
  }
  return (
    <>
      <dt className="text-muted-foreground">Git</dt>
      <dd className="font-mono">
        {data.version}
        {!data.supported && (
          <span className="ml-2 font-sans text-warning">(needs {data.minimumVersion}+)</span>
        )}
      </dd>
      <dt className="text-muted-foreground">Git path</dt>
      <dd className="font-mono break-all select-text">{data.path}</dd>
    </>
  );
}
