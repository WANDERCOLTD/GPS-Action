/**
 * @build-unit BU-000-scaffold
 * @spec architecture/decision-log.md (D003)
 *
 * Landing page — skeleton placeholder. Real landing page lands in its
 * own session (see BU-005 in the engineering roadmap).
 */

export default function Page() {
  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-3)' }}>GPS Action</h1>
      <p style={{ color: 'var(--colour-text-secondary)' }}>
        Skeleton running. Next: build the ERD, then features.
      </p>
    </main>
  );
}
