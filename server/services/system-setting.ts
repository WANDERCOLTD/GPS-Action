/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D058)
 *
 * SystemSetting service — generic key/value access for global config.
 * Values are stored as TEXT and parsed at the read site. The set()
 * function is admin-only at the router boundary; the service itself
 * doesn't enforce auth (callers are trusted).
 *
 * Layer boundary: services → db + lib + shared only.
 */

import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';

/** Get the raw string value for a setting. Returns null when unset. */
export async function getSystemSetting(key: string): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Get a setting and parse as integer; returns the fallback when unset or unparseable. */
export async function getSystemSettingInt(key: string, fallback: number): Promise<number> {
  const raw = await getSystemSetting(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Upsert a setting and emit an audit-log entry. */
export async function setSystemSetting(input: {
  key: string;
  value: string;
  updatedByUserId: string;
}): Promise<void> {
  const { key, value, updatedByUserId } = input;

  const existing = await prisma.systemSetting.findUnique({ where: { key } });

  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, updatedByUserId },
    update: { value, updatedByUserId },
  });

  await auditLog({
    action: existing ? 'system_setting_updated' : 'system_setting_created',
    entityType: 'SystemSetting',
    entityId: key,
    userId: updatedByUserId,
    changes: {
      key,
      previousValue: existing?.value ?? null,
      newValue: value,
    },
    context: { source: 'system_setting' },
  });
}
