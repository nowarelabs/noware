import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface A11yViolation {
  severity: "critical" | "serious" | "moderate" | "minor";
  wcag: string;
  impact: string;
  html: string;
  failureSummary: string;
  line?: number;
}

function findAttr(html: string, attr: string): string | null {
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = re.exec(html);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

function auditHtml(fragment: string, standard: string): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const lineAt = (index: number) => fragment.slice(0, index).split("\n").length;

  for (const m of fragment.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const alt = findAttr(tag, "alt");
    if (alt === null) {
      violations.push({ severity: "serious", wcag: "1.1.1", impact: "Non-text Content", html: tag, failureSummary: "Image has no alt attribute.", line: lineAt(m.index) });
    } else if (alt.trim() === "") {
      // decorative image: acceptable
    }
  }

  for (const m of fragment.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const type = (findAttr(tag, "type") ?? "text").toLowerCase();
    if (type === "hidden" || type === "submit" || type === "button" || type === "reset" || type === "image") continue;
    const id = findAttr(tag, "id");
    if (!id) {
      violations.push({ severity: "serious", wcag: "3.3.2", impact: "Labels or Instructions", html: tag, failureSummary: "Form control has no accessible label (no id for label[for]).", line: lineAt(m.index) });
      continue;
    }
    const labelled = new RegExp(`<label[^>]*for\\s*=\\s*["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`).test(fragment);
    if (!labelled && !/aria-label\s*=|aria-labelledby\s*=/.test(tag)) {
      violations.push({ severity: "serious", wcag: "3.3.2", impact: "Labels or Instructions", html: tag, failureSummary: `Input #${id} has no associated label or aria-label.`, line: lineAt(m.index) });
    }
  }

  for (const m of fragment.matchAll(/<button\b[^>]*>(.*?)<\/button>/gi)) {
    const tag = m[0];
    const inner = m[1].replace(/<[^>]+>/g, "").trim();
    if (!inner && !/aria-label\s*=|aria-labelledby\s*=/.test(tag)) {
      violations.push({ severity: "serious", wcag: "4.1.2", impact: "Name, Role, Value", html: tag, failureSummary: "Button has no accessible name.", line: lineAt(m.index) });
    }
  }

  for (const m of fragment.matchAll(/<a\b[^>]*>(.*?)<\/a>/gi)) {
    const tag = m[0];
    const inner = m[1].replace(/<[^>]+>/g, "").trim();
    if (!inner && !/aria-label\s*=|aria-labelledby\s*=/.test(tag)) {
      violations.push({ severity: "moderate", wcag: "2.4.4", impact: "Link Purpose", html: tag, failureSummary: "Link has no accessible text.", line: lineAt(m.index) });
    }
  }

  const htmlMatches = [...fragment.matchAll(/<html\b[^>]*>/gi)];
  if (htmlMatches.length > 0 && !/\blang\s*=/.test(htmlMatches[0][0])) {
    violations.push({ severity: "serious", wcag: "3.1.1", impact: "Language of Page", html: htmlMatches[0][0], failureSummary: "<html> element has no lang attribute.", line: lineAt(htmlMatches[0].index) });
  }

  const headings = [...fragment.matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) => ({ level: Number(m[1]), index: m.index }));
  if (headings.length > 1 && headings[0].level !== 1) {
    violations.push({ severity: "moderate", wcag: "1.3.1", impact: "Info and Relationships", html: fragment.slice(headings[0].index, headings[0].index + 12), failureSummary: "Page does not begin with a level-1 heading.", line: lineAt(headings[0].index) });
  }
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      violations.push({ severity: "moderate", wcag: "1.3.1", impact: "Info and Relationships", html: fragment.slice(headings[i].index, headings[i].index + 12), failureSummary: `Heading level skipped from h${headings[i - 1].level} to h${headings[i].level}.`, line: lineAt(headings[i].index) });
    }
  }

  const ids: { id: string; line: number }[] = [];
  for (const m of fragment.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    ids.push({ id: m[1], line: lineAt(m.index) });
  }
  const seen = new Set<string>();
  for (const { id, line } of ids) {
    if (seen.has(id)) violations.push({ severity: "serious", wcag: "4.1.1", impact: "Parsing", html: `id="${id}"`, failureSummary: `Duplicate id "${id}" on page.`, line });
    seen.add(id);
  }

  void standard;
  return violations;
}

export class AccessibilityCheckerTool extends WorkerEntrypoint<Env> {
  async auditPage(input: { url: string; standard?: string }): Promise<unknown> {
    const standard = input.standard ?? "wcag2aa";
    const res = await fetch(input.url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`fetch ${input.url} returned HTTP ${res.status}`);
    const html = await res.text();

    const violations = auditHtml(html, standard);
    const bySeverity = (sev: string) => violations.filter((v) => v.severity === sev).length;

    return {
      url: input.url,
      standard,
      violations,
      summary: {
        total: violations.length,
        critical: bySeverity("critical"),
        serious: bySeverity("serious"),
        moderate: bySeverity("moderate"),
        minor: bySeverity("minor"),
        wcagPassing: violations.length === 0 ? "likely pass (static checks)" : "not passing (static checks)",
      },
      note: "Static HTML checks only; dynamic and color-contrast checks require a browser.",
    };
  }

  async auditComponent(input: { component: unknown; standard?: string }): Promise<unknown> {
    const standard = input.standard ?? "wcag2aa";
    let fragment = "";
    if (typeof input.component === "string") {
      fragment = input.component;
    } else if (input.component && typeof input.component === "object") {
      const maybe = input.component as { html?: string; props?: Record<string, unknown>; children?: string };
      fragment = maybe.html ?? (maybe.children ? `<div>${maybe.children}</div>` : "");
      if (!fragment && maybe.props) {
        fragment = Object.keys(maybe.props).length ? `<div>${JSON.stringify(maybe.props)}</div>` : "";
      }
    }
    if (!fragment) {
      return { standard, violations: [], summary: { total: 0 }, note: "component must be an HTML string or { html, children } object" };
    }
    const violations = auditHtml(fragment, standard);
    return {
      standard,
      violations,
      summary: {
        total: violations.length,
        critical: violations.filter((v) => v.severity === "critical").length,
        serious: violations.filter((v) => v.severity === "serious").length,
        moderate: violations.filter((v) => v.severity === "moderate").length,
        minor: violations.filter((v) => v.severity === "minor").length,
      },
    };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      "This worker is only callable via RPC service binding.",
      { status: 400 },
    );
  },
};
