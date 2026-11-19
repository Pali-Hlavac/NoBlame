/**
 * Remote URLs of the known hosting services: their web page, and the same repository over
 * HTTPS or SSH. GitHub, GitLab and Bitbucket use `https://host/owner/repo.git` and
 * `git@host:owner/repo.git`; Azure DevOps uses `https://dev.azure.com/org/project/_git/repo` and
 * `git@ssh.dev.azure.com:v3/org/project/repo` (older `org.visualstudio.com` addresses:
 * `https://org.visualstudio.com/project/_git/repo`, `org@vs-ssh.visualstudio.com:v3/org/project/repo`).
 */

const SIMPLE_HOSTS = ["github.com", "gitlab.com", "bitbucket.org"];

/** Where a URL points: host and path, without user, `.git` or the scheme. */
interface Parsed {
  kind: "https" | "ssh";
  host: string;
  path: string;
}

function parse(url: string): Parsed | null {
  const web = /^https?:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/.exec(url);
  if (web?.[1] && web[2]) return { kind: "https", host: web[1].toLowerCase(), path: web[2] };
  const scp = /^(?:[^@/]+@)?([^/:]+):(?!\/\/)(.+?)(?:\.git)?\/?$/.exec(url);
  if (scp?.[1] && scp[2]) return { kind: "ssh", host: scp[1].toLowerCase(), path: scp[2] };
  const ssh = /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/.exec(url);
  if (ssh?.[1] && ssh[2]) return { kind: "ssh", host: ssh[1].toLowerCase(), path: ssh[2] };
  return null;
}

/** Azure DevOps: organization, project, repository; null for other hosts. */
function azure(parsed: Parsed): { org: string; project: string; repo: string } | null {
  const parts = parsed.path.split("/");
  if (parsed.kind === "https" && parsed.host === "dev.azure.com" && parts[2] === "_git") {
    const [org, project, , repo] = parts;
    return org && project && repo ? { org, project, repo } : null;
  }
  const visualStudio = /^([^.]+)\.visualstudio\.com$/.exec(parsed.host);
  if (parsed.kind === "https" && visualStudio?.[1]) {
    const tail = parts.filter((part) => part !== "DefaultCollection");
    const [project, git, repo] = tail;
    return project && git === "_git" && repo ? { org: visualStudio[1], project, repo } : null;
  }
  if (
    parsed.kind === "ssh" &&
    /^(ssh\.dev\.azure\.com|vs-ssh\.visualstudio\.com)$/.test(parsed.host)
  ) {
    const [version, org, project, repo] = parts;
    return version === "v3" && org && project && repo ? { org, project, repo } : null;
  }
  return null;
}

/** The repository's web page, for known hosts and any other `https://` remote; null otherwise. */
export function webPage(url: string): string | null {
  const parsed = parse(url);
  if (!parsed) return null;
  const devops = azure(parsed);
  if (devops) return `https://dev.azure.com/${devops.org}/${devops.project}/_git/${devops.repo}`;
  if (parsed.kind === "https" || SIMPLE_HOSTS.includes(parsed.host)) {
    return `https://${parsed.host}/${parsed.path}`;
  }
  return null;
}

/** The same repository over the other protocol, for the known hosts; null otherwise. */
export function otherProtocol(url: string): { kind: "https" | "ssh"; url: string } | null {
  const parsed = parse(url);
  if (!parsed) return null;
  const devops = azure(parsed);
  if (devops) {
    const { org, project, repo } = devops;
    return parsed.kind === "https"
      ? { kind: "ssh", url: `git@ssh.dev.azure.com:v3/${org}/${project}/${repo}` }
      : { kind: "https", url: `https://dev.azure.com/${org}/${project}/_git/${repo}` };
  }
  if (!SIMPLE_HOSTS.includes(parsed.host)) return null;
  return parsed.kind === "https"
    ? { kind: "ssh", url: `git@${parsed.host}:${parsed.path}.git` }
    : { kind: "https", url: `https://${parsed.host}/${parsed.path}.git` };
}
