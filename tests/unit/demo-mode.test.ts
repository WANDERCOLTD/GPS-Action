import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('isDemoMode', () => {
  const originalDemoMode = process.env.DEMO_MODE;
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    delete process.env.DEMO_MODE;
    delete process.env.VERCEL_ENV;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDemoMode !== undefined) process.env.DEMO_MODE = originalDemoMode;
    else delete process.env.DEMO_MODE;
    if (originalVercelEnv !== undefined) process.env.VERCEL_ENV = originalVercelEnv;
    else delete process.env.VERCEL_ENV;
  });

  async function load(): Promise<typeof import('@/shared/demo-mode')> {
    return import('@/shared/demo-mode');
  }

  it('returns false when DEMO_MODE is unset', async () => {
    const { isDemoMode } = await load();
    expect(isDemoMode()).toBe(false);
  });

  it.each(['1', 'true', 'yes', 'on', 'TRUE', 'Yes', 'ON'])(
    'returns true when DEMO_MODE=%s',
    async (value) => {
      process.env.DEMO_MODE = value;
      const { isDemoMode } = await load();
      expect(isDemoMode()).toBe(true);
    },
  );

  it.each(['0', 'false', 'no', 'off', '', 'banana'])(
    'returns false when DEMO_MODE=%s',
    async (value) => {
      process.env.DEMO_MODE = value;
      const { isDemoMode } = await load();
      expect(isDemoMode()).toBe(false);
    },
  );

  it('trims whitespace before evaluating', async () => {
    process.env.DEMO_MODE = '  1  ';
    const { isDemoMode } = await load();
    expect(isDemoMode()).toBe(true);
  });

  it('throws at module load when DEMO_MODE=1 AND VERCEL_ENV=production', async () => {
    process.env.DEMO_MODE = '1';
    process.env.VERCEL_ENV = 'production';
    await expect(load()).rejects.toThrow(/DEMO_MODE=1.*VERCEL_ENV=production/);
  });

  it('does not throw when DEMO_MODE=1 AND VERCEL_ENV=preview', async () => {
    process.env.DEMO_MODE = '1';
    process.env.VERCEL_ENV = 'preview';
    await expect(load()).resolves.toBeDefined();
  });

  it('does not throw when DEMO_MODE is unset on a real-prod Vercel project', async () => {
    process.env.VERCEL_ENV = 'production';
    await expect(load()).resolves.toBeDefined();
  });
});
