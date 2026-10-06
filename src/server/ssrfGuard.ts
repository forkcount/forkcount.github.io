import { URL } from 'url';

// Allowed domain list for outbound server requests
const ALLOWED_DOMAINS = new Set([
  'api.nal.usda.gov',
  'api.resend.com',
  'ipapi.co',
  'generativelanguage.googleapis.com',
  'world.openfoodfacts.org',
  'openfoodfacts.org',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);

/**
 * Checks if a hostname or IP address is internal, loopback, cloud metadata, or private network address.
 */
export function isPrivateOrInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();

  // Block localhost, local domain, or metadata hostnames
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'local' ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal' ||
    host === '169.254.169.254'
  ) {
    return true;
  }

  // Parse IPv4 address
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = host.match(ipv4Regex);
  if (match) {
    const p1 = parseInt(match[1], 10);
    const p2 = parseInt(match[2], 10);

    // 0.0.0.0/8
    if (p1 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (p1 === 127) return true;
    // 10.0.0.0/8 (Private RFC 1918)
    if (p1 === 10) return true;
    // 172.16.0.0/12 (Private RFC 1918)
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    // 192.168.0.0/16 (Private RFC 1918)
    if (p1 === 192 && p2 === 168) return true;
    // 169.254.0.0/16 (Link local & AWS/GCP/Azure Metadata 169.254.169.254)
    if (p1 === 169 && p2 === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (p1 === 100 && p2 >= 64 && p2 <= 127) return true;
  }

  // IPv6 checks (loopback ::1, link-local fe80::, unique local fc00::/fd00::)
  if (
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates an outbound URL to prevent SSRF (Server-Side Request Forgery).
 * Enforces HTTPS scheme, blocks private/internal IPs/hostnames, and validates against allowed domain list.
 */
export function validateOutboundUrl(
  urlInput: string,
  options?: { allowListOnly?: boolean; additionalAllowedDomains?: string[] }
): { valid: boolean; reason?: string; url?: URL } {
  if (!urlInput || typeof urlInput !== 'string') {
    return { valid: false, reason: 'Invalid or missing URL input' };
  }

  const trimmed = urlInput.trim();

  // Allow data URIs (e.g. data:image/jpeg;base64,...) if provided for inline images
  if (trimmed.startsWith('data:image/')) {
    return { valid: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Malformed URL format' };
  }

  // Protocol must be https: (or http: if explicitly allowed)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Blocked protocol: only HTTP/HTTPS allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block private IPs, loopback, and cloud metadata targets
  if (isPrivateOrInternalHost(hostname)) {
    return { valid: false, reason: `Blocked internal or private network target: ${hostname}` };
  }

  // Domain allow-list enforcement (if allowListOnly is true or default)
  if (options?.allowListOnly !== false) {
    const combinedAllowList = new Set([
      ...ALLOWED_DOMAINS,
      ...(options?.additionalAllowedDomains || [])
    ]);

    let isAllowed = false;
    for (const allowedDomain of combinedAllowList) {
      if (hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`)) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      return { valid: false, reason: `Domain ${hostname} is not in the allowed outbound domain list` };
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Safe fetch wrapper that validates URLs against SSRF rules before making outbound HTTP requests.
 * Prevents returning raw sensitive internal response bodies.
 */
export async function safeOutboundFetch(
  urlInput: string,
  init?: RequestInit,
  options?: { allowListOnly?: boolean; additionalAllowedDomains?: string[] }
): Promise<Response> {
  const validation = validateOutboundUrl(urlInput, options);
  if (!validation.valid || (!validation.url && !urlInput.startsWith('data:image/'))) {
    throw new Error(`SSRF Prevention: Outbound request blocked. ${validation.reason}`);
  }

  const targetUrl = validation.url ? validation.url.toString() : urlInput;
  const response = await fetch(targetUrl, init);

  return response;
}
