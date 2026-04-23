# GPS Action — Security Baseline

*The concrete rules for protecting personal data, authenticating users, and defending against realistic threats. Every session consults this before building features that touch sensitive data.*

*Version: 0.1 · April 2026*

---

## The threat model

GPS Action is not Google. It doesn't need to survive state-level attacks. But it holds personal data on members, incident reports from victims, and a trust graph — all of which must not leak.

Realistic threats we defend against:

- **Threat A:** Stolen database dump (backup leak, compromised storage, ops mistake)
- **Threat B:** Compromised application server (app shell access, running process inspection)
- **Threat C:** Compromised database server (direct DB admin access)
- **Threat D:** Insider threat (legitimate access misused)
- **Threat E:** Cloud provider compromise (rare but catastrophic)
- **Threat F:** Credential compromise (phishing, password reuse, password spraying)
- **Threat G:** Injection / XSS / CSRF (web application attacks)

Different techniques defend against different threats. The baseline below maps each.

---

## Data classification

Not all data needs the same protection. Three tiers:

### Tier 1 · Personal identifiers (encrypt always)

Data that identifies a real person and harms them if leaked. Stored encrypted at rest.

- Full names (legal names, real names)
- Email addresses
- Phone numbers
- Postal addresses, postcodes (full)
- Social media links
- IP addresses (when logged beyond immediate security needs)
- VOA incident report bodies (victim-submitted trauma content)
- Vetting case discussion threads (contain candid judgements)
- Admin DM contents (coordinator ↔ member conversations)
- Media files: images, PDFs (can contain faces, documents)

**Defence:** Threats A, C, E. If someone steals the DB file, they see ciphertext.

### Tier 2 · Pseudonymous data (encrypt where searchable, otherwise hash+encrypt)

Data that could link back to identity if combined with other data. Needs care.

- Regional postcodes (prefix only — "SW1") — stored plain, fine at this granularity
- Full postcodes — Tier 1
- Location-bound content (which posts a user engaged with, what regions they serve) — stored plain; identifier joins are the vulnerability
- Contact lists (Routes, partner orgs) — stored plain; the routes themselves are often operational info

For fields we need to search on but which contain PII:
- **Deterministic encryption** for email equality searches (same input → same ciphertext). Weaker than randomised; acceptable for searches.
- **Blind indexes** — hash of normalised value (lowercase email prefix) stored alongside encrypted full value. Search by blind index, return by decryption.

### Tier 3 · Non-sensitive / public-ish data (stored plain)

- User IDs (UUIDs — meaningless on their own)
- Post content that's public by nature
- Reactions, view counts, timestamps
- Role labels, permission flags
- Audit event types (the event happened; what the event was about is separately protected)
- Aggregated metrics
- Feature flag states

**Principle:** default to encrypting unless confirmed non-sensitive. Err on the side of protection.

---

## Encryption at rest

### The pattern: envelope encryption with KMS

- **Master key** lives in AWS KMS (or equivalent — Google Cloud KMS, Azure Key Vault). Never leaves KMS.
- **Data encryption keys (DEKs)** are generated per data category, encrypted by the master key, stored in the DB.
- **Application requests decryption** of the DEK from KMS (logged, rate-limited). DEK in memory. Used to encrypt/decrypt field values. DEK cleared from memory after short TTL.
- **No secrets in application code.** No secrets in environment variables that end up in logs.

### Concretely for MVP

- AWS KMS for master keys. UK or EEA region (eu-west-2 London).
- Prisma Client Extension or Drizzle middleware to encrypt/decrypt Tier 1 fields transparently.
- Separate DEKs for: user identity fields, post sensitive content, admin DM content, VOA content.
- Key rotation every 6 months. AWS KMS supports rotation without re-encrypting data (re-wraps DEKs).

### What this defeats

- **Threat A (stolen dump):** ciphertext is useless without master key access. Attacker has meaningless bytes for all Tier 1 fields.
- **Threat C (DB admin):** if they can only read the DB but not KMS, they get ciphertext. Partial defence.
- **Threat E (cloud provider):** AWS itself can't read the encrypted fields without KMS access. Not perfect (AWS controls KMS) but significant.

### What this does NOT defeat

- **Threat B (compromised app):** the app has access to decrypt. If the app is compromised, the attacker has what the app has. Defence: Threats B and D need different mitigations (below).
- **Threat D (insider):** if the insider is on the app team, same as B. If they're DB-only, encryption helps.

---

## Password storage

Passwords are *never* encrypted. They are hashed, slowly, with a salt.

### The rules

- **Algorithm:** Argon2id (preferred) or bcrypt (acceptable fallback).
- **Parameters:** tuned so a single hash takes ~250ms on production hardware.
- **Salt:** unique per password, managed by the hashing library (do not roll your own).
- **No recovery.** Forgot-password flows issue reset links. Never send the password.
- **No logs.** Password input is never logged, never appears in stack traces, never printed in dev mode.
- **Password complexity:** require 12+ characters. Don't require complexity rules (mixed case etc.) that just encourage `Password1!` — length is the defence.
- **Check against known-breached** via haveibeenpwned.com API at set time and on reset. Reject known-breached passwords.

### 2FA is mandatory

- TOTP (Time-based One-Time Password) as default second factor. Free via any authenticator app (Google Authenticator, Authy, 1Password, etc.)
- Backup codes (8 single-use codes) issued at setup. Stored hashed.
- SMS-based 2FA is *discouraged* (SIM-swap attacks) but may be offered as fallback.
- Every user must enable 2FA before gaining publishing rights.
- Admin accounts must have 2FA — no option.

---

## Authentication & session management

### Rules

- **Sessions are JWTs** (or equivalent signed tokens). Short-lived access tokens (15 min) + refresh tokens (30 days).
- **Refresh tokens rotate on use.** Each refresh issues a new refresh token, invalidating the old.
- **Device tracking.** Users can see their active sessions and log out devices individually.
- **Session invalidation on password change.** All sessions killed.
- **Session invalidation on suspicious activity.** Geographic anomalies, rapid IP changes.
- **Login attempts rate-limited.** 5 failed attempts per 15 min per account; 10 per 15 min per IP.
- **Brute-force protection.** After 5 failed attempts, exponential backoff on that account.

### Recovery flows

- **Forgot password:** time-limited reset link emailed. Single-use. 1-hour expiry.
- **Lost 2FA device:** recovery via coordinator (out-of-band verification) + email confirmation + backup code as alternative.
- **Lost email access:** director-only recovery path. Requires voice verification with a known contact.
- **Account recovery events always logged** and notified to the user via all known channels.

---

## Authorization

### Rules

- **Every API endpoint checks permission.** Not just authentication.
- **Shared `checkPermission(user, action, scope)` function.** Not inline role comparisons.
- **Permission matrix is code, not prose.** Single source of truth.
- **Default deny.** If a permission isn't explicitly granted, it's denied.
- **Scoped permissions.** "Coordinator can edit posts" — in which region? Scope is part of the permission.
- **Audit every permission-gated action.**

### Permission matrix (example for post edit)

```typescript
const permissions = {
  'post.create': {
    roles: ['member', 'writer', 'coordinator', 'director'],
    scope: 'self', // applies to own content only
  },
  'post.edit.content.own': {
    roles: ['member', 'writer', 'coordinator', 'director'],
    scope: 'self.within_window',
  },
  'post.edit.content.other': {
    roles: ['coordinator', 'director'],
    scope: 'region.coordinator_only_own_region',
  },
  'post.pin.region': {
    roles: ['coordinator', 'director'],
    scope: 'region',
  },
  'post.pin.national': {
    roles: ['director'],
    scope: 'national',
  },
  // etc
}
```

Every feature uses this map. Never inline.

---

## Audit logging

### What to audit

- Every state-changing operation (create, update, delete on any Tier 1 or Tier 2 data)
- Every permission-gated action (who did what to what)
- Every login attempt (success and failure)
- Every permission denial (who tried to do what)
- Every sensitive data access (read operations on VOA, vetting, admin DMs)
- Every configuration change (routes, permissions, feature flags)
- Every admin action (user suspension, content removal, verdict flips)

### What not to audit

- Routine reads of public data (feed scrolling, reactions)
- View counts (aggregate metrics only)
- UI state changes (filter selections etc.)

### Audit log rules

- **Append-only.** No updates, no deletes on audit entries.
- **Backup separately.** Audit log is a distinct storage target so a compromised main DB doesn't erase the trail.
- **Integrity-checked.** Periodic hashing of audit sequence detects tampering.
- **Retained for 7 years minimum** for regulatory compliance.
- **Accessible to directors.** Coordinators see audit for their region.
- **Not PII-heavy.** Audit entries use user IDs, not full names/emails. Tier 1 data referenced by ID only.

### Structured logging format

Every log entry:
```
{
  timestamp: ISO8601,
  trace_id: UUID (ties request to all its sub-operations),
  user_id: UUID | 'anonymous' | 'system',
  action: string (from a defined enum),
  resource_type: string,
  resource_id: UUID,
  outcome: 'success' | 'denied' | 'error',
  details: { ... } (action-specific),
  ip_hash: string (hashed, not raw),
  user_agent_hash: string,
}
```

---

## Network security

### Rules

- **All traffic over TLS.** No HTTP. HSTS enabled. HTTPS-only cookies.
- **Certificate pinning** for native mobile apps (Phase 2).
- **API endpoints rate-limited.** Per endpoint, per user, per IP.
- **CORS explicitly configured.** Only GPS-owned origins allowed.
- **CSRF tokens** on all state-changing operations.
- **Content-Security-Policy** configured strictly. No inline scripts.
- **Database firewalled.** Only app servers can reach it. Not public-internet-accessible.
- **Admin surfaces** require IP allowlisting or VPN in Phase 2.

### Secrets management

- No secrets in git repositories. Ever.
- No secrets in environment variables that get dumped to logs.
- AWS Secrets Manager (or equivalent) for all production secrets.
- Rotation schedule: database credentials 90 days, API keys 180 days.
- Emergency rotation: any suspected leak, immediate rotation with all instances restarted.
- Development uses fake credentials loaded from `.env.local` (gitignored).

---

## Input validation & injection defence

### Rules

- **Every API input validated** at the boundary. Use Zod or equivalent schemas.
- **Type constraints enforced** (string length, number range, enum values).
- **Prisma/Drizzle parameterised queries.** Never string-concatenate SQL.
- **User-uploaded content sanitised** for XSS (DOMPurify on render where HTML allowed).
- **File uploads restricted:**
  - Size limits per type
  - MIME type validated against content (not just extension)
  - Malware scan before storage (ClamAV or cloud equivalent)
  - Stored in separate bucket; served via signed URLs, never raw
- **URL inputs validated.** No javascript: URLs. No data: URLs that execute.
- **Email addresses validated.** Regex + domain validity check.

---

## Data retention & deletion

### Rules

- **Soft-delete by default** for user-generated content. Retained but hidden.
- **Hard-delete on GDPR subject-access request.** Complete erasure.
- **Declined vetting cases retained 12 months** then purged (scheduled job).
- **Suspended member accounts retained 6 months** then anonymised. Audit trail references "deleted user abc123" not the original name.
- **Backup data follows same retention.** Old backups purged on schedule.
- **Logs retained 2 years.** Audit logs 7 years.

### Deletion technique

- "Deletion" of Tier 1 encrypted data means destroying the DEK. Without the DEK, the ciphertext is unrecoverable — effective cryptographic erasure.
- For backups, age-out is acceptable (won't be decryptable in 12 months because DEK is gone).
- Audit entries referencing the user become "user_id: anonymised_abc" post-deletion.

### Subject access requests (SAR)

- Exportable format: JSON, CSV, PDF
- Includes: profile, posts authored, actions taken, vouches given and received, membership history
- Excludes: other members' private content (DMs, vetting cases, personal data)
- Provided within 30 days of request per UK GDPR

---

## Cryptographic hygiene

### Rules

- **Use established libraries**, never roll your own crypto.
- **TLS 1.2 minimum**, prefer 1.3.
- **Don't use MD5 or SHA-1** anywhere. SHA-256 minimum.
- **Don't use ECB mode** for encryption. GCM or XChaCha20-Poly1305.
- **Random values from `crypto.randomBytes()`** or equivalent. Never `Math.random()` for anything security-related.
- **Constant-time comparison** for token and hash verification (avoid timing attacks).
- **HMAC for message integrity.** Signed tokens (JWT) use HMAC or RSA.

---

## Incident response

### When something happens

- **Define "incident":**
  - Known data breach (Tier 1 or 2 data exposed)
  - Suspected unauthorised access
  - Production outage affecting integrity
  - Malicious content in the network (coordinated attack)

### Playbook

1. **Detect** — monitoring alert, user report, routine audit
2. **Contain** — kill switch, revoke compromised credentials, isolate affected services
3. **Assess** — scope of exposure, affected users, regulatory implications
4. **Notify:**
   - Users affected (if Tier 1 data compromised, within 72 hours per GDPR)
   - Regulator (ICO for UK data breaches)
   - Team (internal Slack/WhatsApp, pre-defined on-call)
5. **Remediate** — fix the root cause, not just the symptom
6. **Document** — post-mortem, public statement if appropriate, lessons into baseline

### Roles

- **Incident commander:** director on call
- **Technical lead:** engineer diagnosing and fixing
- **Communications:** director or designated comms lead
- **Legal/compliance:** director + external counsel if breach is significant

### Contact list

*Maintained separately. Includes:*
- Internal team (numbers, emergency emails)
- Cloud provider support (account IDs, support plan)
- Legal counsel
- ICO reporting channel
- PR/comms support (if retained)

---

## Ongoing security practices

### Automated

- **Dependency scanning:** GitHub Dependabot, Snyk, or equivalent. Weekly scan, automatic PRs for critical CVEs.
- **Static analysis:** ESLint security plugin, Semgrep, or similar on every PR.
- **Secret scanning:** gitleaks or equivalent on every commit.
- **Container image scanning** if using containers.
- **Penetration testing:** annually (minimum) by an external firm.

### Manual

- **Quarterly access review:** who has what access, is it still needed, log unused access for revocation.
- **Incident drill:** twice a year, walk through the incident playbook with the team.
- **Security training:** team members complete basic secure-coding training annually.
- **Third-party risk review:** annually assess each integration (AWS, SendGrid, etc.) for updated practices.

---

## What this doesn't cover

Things that need their own treatment:

- **Physical security** (offices, devices) — separate operational policy
- **Backup and disaster recovery** — separate engineering document
- **Third-party integrations** — each needs its own security review (which contractor has what data access)
- **Regulatory detail** (GDPR, charity law) — legal counsel's remit
- **Content moderation policies** — a product/community doc, not a security doc

Reference those separately.

---

## For every Claude Code session

A session brief building anything that touches personal data should reference this baseline in its "Context" section. Specific obligations:

- Tier 1 fields → use shared `encrypt()` / `decrypt()` helpers
- Authentication → use shared auth middleware, don't roll your own
- Permission check → use `checkPermission()`, never inline
- Audit logging → use `audit.log()` helper
- User-facing errors → use defined error codes, never leak internals
- Input validation → Zod schema at API boundary, always

A session that violates the baseline isn't merged. The reviewer checklist (§9) enforces.

---

## Updating this baseline

This document evolves:

- When new classes of data emerge (e.g. partner-org content, AI-generated content), classify and add
- When threats change (new attack patterns, new platform risks), update defences
- When regulations change (GDPR updates, new UK legislation), adjust retention and notification rules
- After incidents (even near-misses), update based on lessons learned

Version history tracked. Major changes require director review.
