/**
 * Version stamps.
 *
 * - KIT_VERSION   — the code version. Keep in sync with package.json `version`.
 *                   Carried into vendored copies so a consumer can see what they have.
 * - SCHEMA_VERSION — the DATA-CONTRACT version (ticket frontmatter + .tickets.json
 *                   shape). Bump ONLY on a breaking change, and only together with a
 *                   registered migration. See CLAUDE.md § "The data contract".
 *
 * A consumer's data declares its own schema version via `.tickets.json`
 * (`schemaVersion`). Absent ⇒ baseline 1 (data written before versioning existed).
 */

export const KIT_VERSION = '0.3.1';

/** Current data-contract version this kit reads/writes. */
export const SCHEMA_VERSION = 1;

/** The baseline assumed when a project's data declares no schema version. */
export const BASELINE_SCHEMA_VERSION = 1;
