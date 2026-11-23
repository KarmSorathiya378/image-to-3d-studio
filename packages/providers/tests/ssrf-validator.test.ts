import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { SsrfValidator, ProviderError } from '../src/index.ts';

describe('SsrfValidator - Custom Endpoint Safety', () => {
  const validator = new SsrfValidator({ allowHttpLocalhost: false });

  it('blocks access to cloud metadata IP (169.254.169.254)', () => {
    const maliciousUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'https://169.254.169.254/computeMetadata/v1/',
      'http://169.254.169.254:80/latest/user-data',
    ];

    for (const url of maliciousUrls) {
      assert.throws(
        () => validator.validateEndpoint(url),
        (err: unknown) => {
          assert.ok(err instanceof ProviderError);
          assert.strictEqual(err.code, 'SSRF_BLOCKED');
          return true;
        }
      );
    }
  });

  it('blocks access to private RFC 1918 subnets', () => {
    const privateUrls = [
      'https://10.0.0.1:8080/v1',
      'https://10.255.0.1/v1',
      'https://172.16.0.5/api',
      'https://172.31.255.255/',
      'https://192.168.1.1/api',
      'https://192.168.0.254/',
    ];

    for (const url of privateUrls) {
      assert.throws(
        () => validator.validateEndpoint(url),
        (err: unknown) => {
          assert.ok(err instanceof ProviderError);
          assert.strictEqual(err.code, 'SSRF_BLOCKED');
          return true;
        }
      );
    }
  });

  it('blocks access to localhost and loopback interfaces in production mode', () => {
    const loopbackUrls = [
      'https://127.0.0.1:8000/v1',
      'https://127.0.0.2/v1',
      'http://localhost:3000/api',
      'https://localhost:443/v1',
      'https://[::1]:8080/',
    ];

    for (const url of loopbackUrls) {
      assert.throws(
        () => validator.validateEndpoint(url),
        (err: unknown) => {
          assert.ok(err instanceof ProviderError);
          assert.strictEqual(err.code, 'SSRF_BLOCKED');
          return true;
        }
      );
    }
  });

  it('blocks internal cloud domain names', () => {
    const internalDomains = [
      'https://metadata.google.internal/computeMetadata/v1/',
      'https://database.internal/v1',
      'https://redis.local:6379/',
      'https://instance-data/latest/meta-data',
    ];

    for (const url of internalDomains) {
      assert.throws(
        () => validator.validateEndpoint(url),
        (err: unknown) => {
          assert.ok(err instanceof ProviderError);
          assert.strictEqual(err.code, 'SSRF_BLOCKED');
          return true;
        }
      );
    }
  });

  it('blocks non-HTTPS protocols', () => {
    const badProtocols = [
      'file:///etc/passwd',
      'ftp://ftp.openai.com/v1',
      'gopher://localhost:70/',
      'ws://api.openai.com/v1',
    ];

    for (const url of badProtocols) {
      assert.throws(
        () => validator.validateEndpoint(url),
        (err: unknown) => {
          assert.ok(err instanceof ProviderError);
          assert.strictEqual(err.code, 'SSRF_BLOCKED');
          return true;
        }
      );
    }
  });

  it('permits valid, trusted HTTPS provider endpoints', () => {
    const validEndpoints = [
      'https://api.openai.com/v1',
      'https://api.groq.com/openai/v1',
      'https://api.inceptionlabs.ai/v1',
      'https://generativelanguage.googleapis.com',
      'https://api.anthropic.com/v1',
      'https://custom-proxy.my-company.com/v1',
    ];

    for (const url of validEndpoints) {
      const parsed = validator.validateEndpoint(url);
      assert.ok(parsed);
      assert.strictEqual(parsed.protocol, 'https:');
    }
  });
});
