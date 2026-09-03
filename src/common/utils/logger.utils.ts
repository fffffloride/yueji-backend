import type { Request, Response } from "express";
import type { IncomingHttpHeaders } from "http";

interface RequestLogContext {
  url: string;
  method: string;
  clientIP: string;
  userAgent?: string;
  referrer?: string;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: IncomingHttpHeaders;
  body: Record<string, unknown>;
}

const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:authorization|cookie|password|token|secret|signature|ciphertext|privatekey|apiv3key|mobile|phonenumber|phone|openid|unionid)$/.test(
    normalized
  );
}

interface ResponseLogContext {
  statusCode: number;
  latency: number;
  contentLength?: number;
}

export class LoggerUtils {
  static captureRequestContext(req: Request): RequestLogContext {
    return {
      url: this.redactUrl(req.originalUrl),
      method: req.method,
      clientIP: this.parseClientIP(req),
      userAgent: req.headers["user-agent"],
      referrer: req.headers.referer,
      params: this.redact(req.params) as Record<string, unknown>,
      query: this.redact(req.query) as Record<string, unknown>,
      headers: this.redact(req.headers) as IncomingHttpHeaders,
      body: this.redact(req.body) as Record<string, unknown>,
    };
  }

  static captureResponseContext(res: Response, startTime: number): ResponseLogContext {
    return {
      statusCode: res.statusCode,
      latency: Date.now() - startTime,
      contentLength: res.getHeader("content-length") as number,
    };
  }

  static parseClientIP(req: Request): string {
    return (
      req.ip || req.socket?.remoteAddress || req.headers["x-forwarded-for"]?.toString() || "unknown"
    );
  }

  static redact(value: unknown, key = ""): unknown {
    if (isSensitiveKey(key)) return REDACTED;
    if (Buffer.isBuffer(value)) return `[BINARY ${value.length} bytes]`;
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        this.redact(entryValue, entryKey),
      ])
    );
  }

  private static redactUrl(originalUrl: string): string {
    try {
      const url = new URL(originalUrl, "http://localhost");
      for (const key of url.searchParams.keys()) {
        if (isSensitiveKey(key)) url.searchParams.set(key, REDACTED);
      }
      return `${url.pathname}${url.search}`;
    } catch {
      return originalUrl;
    }
  }
}
