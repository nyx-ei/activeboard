import type { Json } from '@/lib/supabase/types';

const SENSITIVE_LOG_METADATA_KEY_PATTERN =
  /(^|_)(email|name|display|avatar|phone|address|token|secret|password|customer|payment_method|stripe_customer|stripe_default_payment_method)(_|$)/i;

const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LogMetadataInput = Record<string, Json | undefined>;

export function isSensitiveLogMetadataKey(key: string) {
  return SENSITIVE_LOG_METADATA_KEY_PATTERN.test(key);
}

export function sanitizeLogMetadata(value: Json | undefined): Json | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return EMAIL_VALUE_PATTERN.test(value.trim()) ? '[redacted]' : value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeLogMetadata(item))
      .filter((item): item is Json => item !== undefined);
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, nested]) => !isSensitiveLogMetadataKey(key) && nested !== undefined)
      .map(([key, nested]) => [key, sanitizeLogMetadata(nested)])
      .filter(([, nested]) => nested !== undefined),
  );
}

export function sanitizeLogMetadataRecord(
  metadata: LogMetadataInput | undefined,
): Json {
  if (!metadata) {
    return {};
  }

  return sanitizeLogMetadata(metadata) ?? {};
}

export function metadataHasSensitiveKeys(value: Json | undefined): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => metadataHasSensitiveKeys(item));
  }

  return Object.entries(value).some(
    ([key, nested]) =>
      isSensitiveLogMetadataKey(key) || metadataHasSensitiveKeys(nested),
  );
}
