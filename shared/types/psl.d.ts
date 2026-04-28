/**
 * @build-unit BU-link-first-composer
 *
 * Ambient declaration for `psl` (Public Suffix List). The package ships
 * types at `node_modules/psl/types/index.d.ts` but its `package.json`
 * `exports` field doesn't expose them, so TypeScript can't resolve them
 * via the normal import path.
 *
 * Only the surface we actually use is declared here. If we extend usage
 * to other psl exports, add them below.
 */

declare module 'psl' {
  export function isValid(domain: string): boolean;
  export function get(domain: string): string | null;
}
