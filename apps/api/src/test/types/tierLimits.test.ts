import { describe, it, expect } from 'vitest';
import { TIER_LIMITS, NotificationEventType, ALL_NOTIFICATION_EVENT_TYPES } from '../../types/index.js';

describe('TIER_LIMITS', () => {
  it('pro tier allows webhook configuration', () => {
    expect(TIER_LIMITS.pro.canConfigureWebhooks).toBe(true);
  });

  it('free tier does not allow webhook configuration', () => {
    expect(TIER_LIMITS.free.canConfigureWebhooks).toBe(false);
  });

  it('team tier allows webhook configuration', () => {
    expect(TIER_LIMITS.team.canConfigureWebhooks).toBe(true);
  });

  it('pro tier allows notifications', () => {
    expect(TIER_LIMITS.pro.canConfigureNotifications).toBe(true);
  });

  it('free tier does not allow notifications', () => {
    expect(TIER_LIMITS.free.canConfigureNotifications).toBe(false);
  });

  it('team tier allows notifications', () => {
    expect(TIER_LIMITS.team.canConfigureNotifications).toBe(true);
  });
});

describe('NotificationEventType', () => {
  it('has all expected event types', () => {
    expect(NotificationEventType.SCAN_COMPLETED).toBe('scan.completed');
    expect(NotificationEventType.FINDING_NEW_CRITICAL).toBe('finding.new_critical');
    expect(NotificationEventType.FINDING_NEW_HIGH).toBe('finding.new_high');
    expect(NotificationEventType.WEEKLY_DIGEST).toBe('weekly_digest');
  });

  it('ALL_NOTIFICATION_EVENT_TYPES contains all values', () => {
    expect(ALL_NOTIFICATION_EVENT_TYPES).toHaveLength(4);
    expect(ALL_NOTIFICATION_EVENT_TYPES).toContain('scan.completed');
    expect(ALL_NOTIFICATION_EVENT_TYPES).toContain('finding.new_critical');
    expect(ALL_NOTIFICATION_EVENT_TYPES).toContain('finding.new_high');
    expect(ALL_NOTIFICATION_EVENT_TYPES).toContain('weekly_digest');
  });
});
