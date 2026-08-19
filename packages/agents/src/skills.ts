/**
 * Skill loading — the `defineSkill` function.
 *
 * Convention: skill files live at `src/skills/<name>/SKILL.md` with YAML
 * frontmatter (`name`, `description`). Supporting files in the same
 * directory are served as read-only resources.
 */

import type { SkillDefinition } from "./types.js";

/**
 * Defines a skill from a markdown string with frontmatter.
 *
 * ```ts
 * export const refunds = defineSkill({
 *   name: 'refunds',
 *   description: 'Handle refund requests',
 *   content: '# Refund Policy\n\n...',
 * });
 * ```
 */
export function defineSkill(opts: {
  name: string;
  description: string;
  content: string;
  files?: Record<string, string>;
}): SkillDefinition {
  return Object.freeze({
    name: opts.name,
    description: opts.description,
    content: opts.content,
    files: opts.files,
  });
}

/**
 * Parses a SKILL.md file with YAML frontmatter.
 * Returns a SkillDefinition suitable for `useSkill()`.
 */
export function parseSkillMarkdown(markdown: string): SkillDefinition {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    throw new Error("Invalid SKILL.md: missing YAML frontmatter");
  }

  const [, frontmatter, body] = frontmatterMatch;
  const name = extractFrontmatterField(frontmatter, "name");
  const description = extractFrontmatterField(frontmatter, "description");

  if (!name) throw new Error("Invalid SKILL.md: missing 'name' field in frontmatter");

  return Object.freeze({
    name,
    description: description ?? "",
    content: body.trim(),
  });
}

function extractFrontmatterField(frontmatter: string, field: string): string | undefined {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*"?([^"\\n]*)"?.*$`, "m"));
  return match?.[1]?.trim();
}
