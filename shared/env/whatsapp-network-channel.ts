/**
 * @build-unit BU-tick-or-cross
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec architecture/decision-log.md (D069)
 *
 * Reads + validates `WHATSAPP_NETWORK_CHANNEL_URL`.
 *
 * The URL is the GPS Network WhatsApp channel deep-link the BU-tick-or-cross
 * publish flow opens after copying the formatted message to the clipboard.
 * Channels do not accept `?text=` prefill (gotcha logged in D069), so the
 * URL itself must be a bare deep-link — typically
 * `https://whatsapp.com/channel/<id>` or `https://chat.whatsapp.com/<invite>`
 * for a group fallback.
 *
 * Validation:
 *   - Must be HTTPS
 *   - Hostname must end in `whatsapp.com`
 *
 * Behaviour:
 *   - In test environments (`NODE_ENV === 'test'`) a missing or invalid
 *     value returns null so unit tests can exercise both paths.
 *   - Anywhere else, throws at module load — fail-fast is the goal so
 *     a misconfigured deploy never serves a broken handoff modal.
 */

const KNOWN_HOST_SUFFIX = '.whatsapp.com';

function readUrl(): string | null {
  const raw = process.env.WHATSAPP_NETWORK_CHANNEL_URL;
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validate(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `[whatsapp-network-channel] WHATSAPP_NETWORK_CHANNEL_URL is not a valid URL: ${url}`,
    );
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `[whatsapp-network-channel] WHATSAPP_NETWORK_CHANNEL_URL must be https; got ${parsed.protocol}`,
    );
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'whatsapp.com' && !host.endsWith(KNOWN_HOST_SUFFIX)) {
    throw new Error(
      `[whatsapp-network-channel] WHATSAPP_NETWORK_CHANNEL_URL host must be whatsapp.com or a subdomain; got ${host}`,
    );
  }
  return url;
}

const isTest = process.env.NODE_ENV === 'test';

const cached: string | null = (() => {
  const raw = readUrl();
  if (!raw) {
    if (isTest) return null;
    throw new Error(
      '[whatsapp-network-channel] WHATSAPP_NETWORK_CHANNEL_URL is not set. ' +
        'BU-tick-or-cross requires this env var. See `.env.example`.',
    );
  }
  try {
    return validate(raw);
  } catch (err) {
    if (isTest) return null;
    throw err;
  }
})();

/**
 * Returns the validated GPS Network channel URL. Throws at module load
 * outside test environments if the env var is missing or invalid, so
 * this function is safe to call from request paths without further
 * checks.
 */
export function whatsappNetworkChannelUrl(): string {
  if (cached === null) {
    throw new Error(
      '[whatsapp-network-channel] WHATSAPP_NETWORK_CHANNEL_URL was unavailable at module load.',
    );
  }
  return cached;
}

/**
 * Test-only escape hatch — returns null when the env var was unset or
 * invalid in a test run, so unit tests can exercise the missing-env path
 * without restarting the module.
 */
export function whatsappNetworkChannelUrlOrNull(): string | null {
  return cached;
}
