import { promises as dns } from "dns";
import { isIP } from "net";

const MAX_PAGES = 25;
const MAX_BYTES_PER_PAGE = 2_000_000; // 2MB
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "ReplyPilotBot/1.0 (+https://replypilot.example/bot)";

const PRIVATE_RANGES: Array<[string, number]> = [
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local / cloud metadata (169.254.169.254)
  ["0.0.0.0", 8],
];

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const target = ipToInt(ip);
  return PRIVATE_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipToInt(base) & mask) === (target & mask);
  });
}

/**
 * Resolves the hostname and rejects anything pointing at a private,
 * loopback, or link-local address — including the AWS/GCP metadata IP
 * (169.254.169.254) — to block SSRF via the crawler. Re-resolved at
 * fetch time too, since DNS can change between check and use
 * (classic TOCTOU); callers should treat this as defense-in-depth, not
 * a one-time gate.
 */
export async function assertSafeCrawlTarget(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http/https URLs are allowed");
  }

  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }

  const hostname = url.hostname;

  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Local/internal hostnames are not allowed");
  }

  if (isIP(hostname)) {
    if (isPrivateIPv4(hostname) || hostname === "::1") {
      throw new Error("Private/loopback IP addresses are not allowed");
    }
    return url;
  }

  const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
  const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);

  if (!addresses.length && !addresses6.length) {
    throw new Error("Could not resolve hostname");
  }

  for (const addr of addresses) {
    if (isPrivateIPv4(addr)) {
      throw new Error("Hostname resolves to a private IP address");
    }
  }
  for (const addr of addresses6) {
    if (addr === "::1" || addr.startsWith("fc00:") || addr.startsWith("fe80:")) {
      throw new Error("Hostname resolves to a private/link-local IPv6 address");
    }
  }

  return url;
}

export interface CrawlResult {
  url: string;
  title: string;
  text: string;
}

/** Very small HTML -> text extractor: strips scripts/styles/nav/footer. */
function extractReadableText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? "";

  let stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { title, text: stripped };
}

export async function crawlSinglePage(rawUrl: string): Promise<CrawlResult> {
  const url = await assertSafeCrawlTarget(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      redirect: "manual", // handle redirects ourselves so we can re-validate the target
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect with no location");
      // Recurse once, through the same SSRF check, rather than trusting
      // fetch()'s automatic redirect handling.
      return crawlSinglePage(new URL(location, url).toString());
    }

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error(`Unsupported content-type: ${contentType}`);
    }

    const reader = res.body?.getReader();
    let received = 0;
    let html = "";
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        if (received > MAX_BYTES_PER_PAGE) {
          throw new Error("Page exceeds max size");
        }
        html += decoder.decode(value, { stream: true });
      }
    }

    const { title, text } = extractReadableText(html);
    return { url: url.toString(), title, text };
  } finally {
    clearTimeout(timeout);
  }
}

export { MAX_PAGES };
