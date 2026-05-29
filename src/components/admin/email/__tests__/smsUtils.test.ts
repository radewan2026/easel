import { describe, it, expect } from 'vitest';
import { smsSegmentCount, smsStatusVariant } from '../emailUtils';

describe('smsSegmentCount', () => {
  it('returns 0 for empty body', () => {
    expect(smsSegmentCount('')).toBe(0);
  });

  it('returns 1 for a body within the single-segment limit', () => {
    expect(smsSegmentCount('Hello there')).toBe(1);
    expect(smsSegmentCount('a'.repeat(160))).toBe(1);
  });

  it('returns 2 once the body exceeds 160 characters', () => {
    expect(smsSegmentCount('a'.repeat(161))).toBe(2);
    expect(smsSegmentCount('a'.repeat(306))).toBe(2);
  });

  it('returns 3 for longer multi-segment messages', () => {
    expect(smsSegmentCount('a'.repeat(307))).toBe(3);
  });
});

describe('smsStatusVariant', () => {
  it('maps delivered/sent to positive variants', () => {
    expect(smsStatusVariant.delivered).toBe('success');
    expect(smsStatusVariant.sent).toBe('primary');
  });

  it('maps failure states to danger', () => {
    expect(smsStatusVariant.failed).toBe('danger');
    expect(smsStatusVariant.bounced).toBe('danger');
  });

  it('maps opt-out to a warning variant', () => {
    expect(smsStatusVariant.opted_out).toBe('warning');
  });
});
