# GPS Action — Entity Relationship Diagram

**Status:** Placeholder — to be built in next session.

This document will contain:

- Visual ERD (Mermaid or draw.io) of all entities and relationships
- Cardinality decisions (one-to-many, many-to-many)
- Soft delete strategy per entity
- Audit linkage
- Indexes (what gets queried frequently)
- Encryption tiers per field (see security baseline)

The authoritative schema lives in `/prisma/schema.prisma`. This document
explains the *why* alongside the *what*.

## Next session

A dedicated Claude Code session will produce this. The brief includes:

- Every primitive from `docs/feature-spec/v0.5.md` §1
- Relationships between them
- Indexes required for the core queries
- Migration plan from the current skeleton Ping entity

After ERD lands, `schema.prisma` becomes real and the `Ping` entity is
removed.
