import * as net from 'node:net';
import { ProviderError } from '../types/errors.ts';

export interface SsrfValidatorOptions {
  readonly allowHttpLocalhost?: boolean;
  readonly allowedDomains?: readonly string[];
}

/**
 * Standard trusted AI provider domains for out-of-the-box allowlisting.
 */
export const TRUSTED_PROVIDER_DOMAINS: readonly string[] = [
  'api.openai.com',
  'api.groq.com',
  'api.inceptionlabs.ai',
  'generativelanguage.googleapis.com',
  'api.anthropic.com',
  'api.tripo3d.ai',
  'api.meshy.ai',
];

/**
 * SSRF and Network Endpoint Validator.
 * Prevents requests to internal subnets, loopbacks, cloud metadata endpoints (169.254.169.254),
 * and non-HTTPS protocols.
 */
export class SsrfValidator {
  private readonly allowHttpLocalhost: boolean;
  private readonly allowedDomains: Set<string>;

  constructor(options?: SsrfValidatorOptions) {
    this.allowHttpLocalhost = options?.allowHttpLocalhost ?? false;
    this.allowedDomains = new Set(
      (options?.allowedDomains ?? TRUSTED_PROVIDER_DOMAINS).map((d) => d.toLowerCase())
    );
  }

  /**
   * Validate a custom provider endpoint URL.
   * Throws ProviderError if URL fails SSRF safety checks.
   */
  public validateEndpoint(urlStr: string): URL {
    if (!urlStr || typeof urlStr !== 'string') {
      throw new ProviderError({
        code: 'INVALID_ENDPOINT',
        retryable: false,
        userMessage: 'Endpoint URL must be a non-empty string.',
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(urlStr.trim());
    } catch {
      throw new ProviderError({
        code: 'INVALID_ENDPOINT',
        retryable: false,
        userMessage: `Malformed endpoint URL: "${urlStr}". Must be a valid absolute URI.`,
      });
    }

    const cleanHost = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

    // Protocol check: HTTPS strictly required (unless local dev HTTP is explicitly enabled)
    const isLocalhostHost =
      cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1';

    if (parsed.protocol === 'http:') {
      if (!this.allowHttpLocalhost || !isLocalhostHost) {
        throw new ProviderError({
          code: 'SSRF_BLOCKED',
          retryable: false,
          userMessage: 'Insecure HTTP protocol is disallowed for provider endpoints. HTTPS is required.',
        });
      }
    } else if (parsed.protocol !== 'https:') {
      throw new ProviderError({
        code: 'SSRF_BLOCKED',
        retryable: false,
        userMessage: `Unsupported protocol "${parsed.protocol}". Only HTTPS endpoints are permitted.`,
      });
    }

    // Check if hostname is an IP address
    const ipType = net.isIP(cleanHost);
    if (ipType !== 0) {
      if (this.isPrivateOrRestrictedIp(cleanHost)) {
        if (!(this.allowHttpLocalhost && (cleanHost === '127.0.0.1' || cleanHost === '::1'))) {
          throw new ProviderError({
            code: 'SSRF_BLOCKED',
            retryable: false,
            userMessage: `Access to private, loopback, or cloud metadata IP (${cleanHost}) is strictly blocked.`,
          });
        }
      }
    }

    // Check against suspicious hostnames
    if (
      cleanHost === 'localhost' &&
      !this.allowHttpLocalhost
    ) {
      throw new ProviderError({
        code: 'SSRF_BLOCKED',
        retryable: false,
        userMessage: 'Access to localhost is blocked.',
      });
    }

    if (
      cleanHost.endsWith('.internal') ||
      cleanHost.endsWith('.local') ||
      cleanHost === 'metadata' ||
      cleanHost === 'metadata.google.internal' ||
      cleanHost === 'instance-data'
    ) {
      throw new ProviderError({
        code: 'SSRF_BLOCKED',
        retryable: false,
        userMessage: `Access to internal cloud domain "${cleanHost}" is blocked for security.`,
      });
    }

    return parsed;
  }

  /**
   * Returns true if an IP belongs to private, loopback, or link-local ranges.
   */
  public isPrivateOrRestrictedIp(ip: string): boolean {
    // IPv4 checks
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
      const [p0, p1] = [parts[0]!, parts[1]!];

      // 127.0.0.0/8 (Loopback)
      if (p0 === 127) return true;

      // 10.0.0.0/8 (Private RFC 1918)
      if (p0 === 10) return true;

      // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 – 172.31.255.255)
      if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

      // 192.168.0.0/16 (Private RFC 1918)
      if (p0 === 192 && p1 === 168) return true;

      // 169.254.0.0/16 (Link Local & AWS/GCP/Azure Metadata 169.254.169.254)
      if (p0 === 169 && p1 === 254) return true;

      // 0.0.0.0/8 (Current network)
      if (p0 === 0) return true;

      // 100.64.0.0/10 (Carrier grade NAT)
      if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

      // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
      if (p0 >= 224) return true;

      return false;
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      // ::1 (Loopback)
      if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
      // :: (Unspecified)
      if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
      // fc00::/7 (Unique Local Address)
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
      // fe80::/10 (Link-Local)
      if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
      // IPv4-mapped IPv6 (::ffff:127.0.0.1 etc)
      if (normalized.includes('::ffff:')) {
        const ipv4Part = normalized.split('::ffff:')[1];
        if (ipv4Part && net.isIPv4(ipv4Part)) {
          return this.isPrivateOrRestrictedIp(ipv4Part);
        }
      }

      return false;
    }

    return true; // Unknown IP formats rejected as restricted
  }
}

export const defaultSsrfValidator = new SsrfValidator();
