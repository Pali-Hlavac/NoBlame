/**
 * The remote editor's Connection settings (see `registry.ts`). HTTP(S) settings are keyed by
 * the remote's server (`http.<server>/.<name>`), so they apply to every address on that server
 * in this repository; the key shown in the tab is the real one.
 */
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import type { RemoteSetting } from "./settingTypes";

const remoteKey = (name: string) => (remote: string) => `remote.${remote}.${name}`;
const serverKey = (name: string) => () => `http.<server>/.${name}`;

/**
 * The key of an HTTP setting for `server` (`https://host:port`): `http.<server>/.<name>`, or
 * the same without the `/` when this repository already has it written that way.
 */
export function httpKey(base: RemoteSettingsDto, server: string, name: string): string {
  const bare = `http.${server}.${name.toLowerCase()}`;
  const written = base.entries.some((entry) => entry.scope === "local" && entry.key === bare);
  return written ? `http.${server}.${name}` : `http.${server}/.${name}`;
}

export const CONNECTION_SETTINGS: readonly RemoteSetting[] = [
  {
    id: "proxy",
    tab: "connection",
    label: "Proxy",
    help: "The HTTP proxy this remote is reached through. Without a setting here, git uses http.proxy or the HTTPS_PROXY variable.",
    key: remoteKey("proxy"),
    synonyms: ["proxy", "company network", "firewall", "http.proxy", "https_proxy"],
  },
  {
    id: "proxyAuthMethod",
    tab: "connection",
    label: "Proxy sign-in",
    help: "How git signs in to the proxy.",
    key: remoteKey("proxyAuthMethod"),
    synonyms: ["proxy", "ntlm", "negotiate", "kerberos", "basic", "digest"],
  },
  {
    id: "sslVerify",
    tab: "connection",
    label: "Verify the server's certificate",
    help: "Whether git checks that the server is who it says it is.",
    key: serverKey("sslVerify"),
    synonyms: ["ssl", "tls", "certificate", "insecure", "self-signed", "https"],
  },
  {
    id: "sslCAInfo",
    tab: "connection",
    label: "Certificate authority file",
    help: "A file of certificates to trust for this server, such as a company's own (PEM).",
    key: serverKey("sslCAInfo"),
    synonyms: ["ca", "certificate", "pem", "root certificate", "company", "trust"],
  },
  {
    id: "sslCert",
    tab: "connection",
    label: "Client certificate",
    help: "A certificate git shows the server to sign in, for servers that ask for one.",
    key: serverKey("sslCert"),
    synonyms: ["certificate", "client", "mutual tls", "pem", "p12"],
  },
  {
    id: "sslKey",
    tab: "connection",
    label: "Client certificate key",
    help: "The private key of the client certificate.",
    key: serverKey("sslKey"),
    synonyms: ["certificate", "key", "client", "pem"],
  },
  {
    id: "sslBackend",
    tab: "connection",
    label: "Certificates come from",
    help: "Which library checks certificates on Windows: the Windows certificate store knows the certificates your company installed.",
    key: () => "http.sslBackend",
    synonyms: ["schannel", "openssl", "windows certificate store", "ssl backend", "certificate"],
    repositoryWide: true,
  },
  {
    id: "extraHeader",
    tab: "connection",
    label: "Extra HTTP headers",
    help: "Headers sent with every request to this server, such as an authorization token. They are kept in plain text in .git/config.",
    key: serverKey("extraHeader"),
    synonyms: ["header", "token", "authorization", "bearer", "pat"],
  },
  {
    id: "httpVersion",
    tab: "connection",
    label: "HTTP version",
    help: "Which HTTP version git speaks to this server; some proxies only manage HTTP/1.1.",
    key: serverKey("version"),
    synonyms: ["http/2", "http2", "http/1.1", "version"],
  },
  {
    id: "postBuffer",
    tab: "connection",
    label: "Push buffer size",
    help: "The largest push sent in one piece (bytes; k, m, g allowed). Raising it rarely helps; very old servers may need it.",
    key: serverKey("postBuffer"),
    synonyms: ["buffer", "large push", "rpc failed", "postBuffer"],
  },
  {
    id: "lowSpeedLimit",
    tab: "connection",
    label: "Give up below this speed",
    help: "Bytes per second; git stops when less arrives for the time below.",
    key: serverKey("lowSpeedLimit"),
    synonyms: ["timeout", "slow", "stalled", "speed"],
  },
  {
    id: "lowSpeedTime",
    tab: "connection",
    label: "…for this long",
    help: "Seconds the speed may stay below the limit above before git gives up.",
    key: serverKey("lowSpeedTime"),
    synonyms: ["timeout", "slow", "stalled", "seconds"],
  },
  {
    id: "sshKey",
    tab: "connection",
    label: "SSH key",
    help: "The private key NoBlame uses when it fetches, pulls, pushes or tests this remote over SSH (GIT_SSH_COMMAND with -i). It is NoBlame's own setting: a terminal does not see it. ~/.ssh/config (Host … IdentityFile …) does the same for every program.",
    key: null,
    synonyms: [
      "ssh",
      "identity",
      "private key",
      "id_rsa",
      "id_ed25519",
      "GIT_SSH_COMMAND",
      "IdentityFile",
    ],
  },
  {
    id: "uploadpack",
    tab: "connection",
    label: "Program serving fetches on the server",
    help: "For SSH servers where git-upload-pack lives somewhere else. Rarely needed.",
    key: remoteKey("uploadpack"),
    synonyms: ["git-upload-pack", "upload pack", "server path"],
  },
  {
    id: "receivepack",
    tab: "connection",
    label: "Program receiving pushes on the server",
    help: "For SSH servers where git-receive-pack lives somewhere else. Rarely needed.",
    key: remoteKey("receivepack"),
    synonyms: ["git-receive-pack", "receive pack", "server path"],
  },
  {
    id: "serverOption",
    tab: "connection",
    label: "Server options",
    help: "Options sent to the server with each fetch (protocol v2), for servers that read them.",
    key: remoteKey("serverOption"),
    synonyms: ["server option", "protocol v2", "push option"],
    since: [2, 48],
  },
];
