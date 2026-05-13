import type { MachineType } from "@/db/schema";

export function getMachineEndpointAndHeaders(machine: MachineType) {
  const { endpoint, basicAuthFromUrl } = normalizeEndpoint(machine.endpoint);
  const authorization = getAuthorizationHeader(
    machine.auth_token,
    basicAuthFromUrl
  );

  return {
    endpoint,
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
  };
}

function normalizeEndpoint(endpoint: string) {
  const trimmed = endpoint.replace(/\/+$/, "");

  try {
    const url = new URL(trimmed);
    if (!url.username && !url.password) {
      return { endpoint: trimmed, basicAuthFromUrl: undefined };
    }

    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    url.username = "";
    url.password = "";

    return {
      endpoint: url.toString().replace(/\/+$/, ""),
      basicAuthFromUrl: `${user}:${password}`,
    };
  } catch {
    return { endpoint: trimmed, basicAuthFromUrl: undefined };
  }
}

function getAuthorizationHeader(
  configuredToken?: string | null,
  basicAuthFromUrl?: string
) {
  const token = configuredToken?.trim() || basicAuthFromUrl?.trim();
  if (!token) return undefined;

  if (/^(Basic|Bearer)\s+/i.test(token)) {
    return token;
  }

  if (token.includes(":")) {
    return `Basic ${Buffer.from(token, "utf8").toString("base64")}`;
  }

  return `Bearer ${token}`;
}
