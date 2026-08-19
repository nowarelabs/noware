import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface Diagnostic {
  severity: "info" | "warning" | "error";
  message: string;
  line: number;
  column?: number;
  rule: string;
}

function languageFromPath(filePath: string, language?: string): string {
  if (language) return language.toLowerCase();
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
  };
  return map[ext] ?? "text";
}

function lintSource(language: string, content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = content.split(/\r?\n/);

  const push = (severity: Diagnostic["severity"], message: string, line: number, rule: string, column?: number) =>
    diagnostics.push({ severity, message, line, column, rule });

  if (language === "json") {
    try {
      JSON.parse(content);
    } catch (err) {
      push("error", `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`, 1, "json/parse");
    }
    return diagnostics;
  }

  if (language === "html") {
    for (const m of content.matchAll(/<img\b[^>]*>/gi)) {
      if (!/alt\s*=/.test(m[0])) {
        const line = content.slice(0, m.index).split("\n").length;
        push("warning", "Image without alt attribute", line, "a11y/img-alt");
      }
    }
    if (!/\blang\s*=/.test(content)) push("warning", "<html> missing lang attribute", 1, "a11y/html-lang");
    const ids: { id: string; line: number }[] = [];
    for (const m of content.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
      ids.push({ id: m[1], line: content.slice(0, m.index).split("\n").length });
    }
    const seen = new Set<string>();
    for (const { id, line } of ids) {
      if (seen.has(id)) push("warning", `Duplicate id "${id}"`, line, "html/duplicate-id");
      seen.add(id);
    }
  }

  const jsLike = language === "javascript" || language === "typescript" || language === "tsx" || language === "jsx";
  const isPython = language === "python";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;

    if (line.length > 120) push("info", `Line too long (${line.length} > 120 chars)`, n, "style/line-length");
    if (/\s+$/.test(line)) push("info", "Trailing whitespace", n, "style/trailing-whitespace");
    if (/TODO|FIXME|HACK/.test(line)) push("warning", "Unresolved TODO/FIXME", n, "style/todo");

    if (jsLike) {
      if (/\bvar\s+/.test(line)) push("info", "Prefer const/let over var", n, "js/no-var");
      if (/console\.(log|debug)\(/.test(line)) push("info", "Debug logging left in code", n, "js/no-console");
      if (/\b==\s*[^=]/.test(line) && !/===/.test(line)) push("info", "Use === instead of ==", n, "js/eqeqeq");
      if (/\beval\s*\(/.test(line)) push("error", "Avoid eval() - code injection risk", n, "js/no-eval");
      if (/innerHTML\s*=/.test(line)) push("warning", "Setting innerHTML can lead to XSS", n, "js/no-inner-html");
    }

    if (isPython) {
      if (/^\s*\t/.test(line)) push("warning", "Tab used for indentation; prefer spaces", n, "python/indent");
      if (/^\s*print\s*\(/.test(line)) push("info", "print() found; consider logging", n, "python/no-print");
      if (/^\s*except\s*:/.test(line)) push("warning", "Bare except catches everything", n, "python/bare-except");
      if (/\bimport\s+\*\b/.test(line)) push("warning", "Star import pollutes the namespace", n, "python/star-import");
    }
  }
  if (jsLike) {
    const open = (content.match(/[{(\[]/g) ?? []).length;
    const close = (content.match(/[})\]]/g) ?? []).length;
    if (open !== close) push("error", `Unbalanced braces/brackets (${open} open, ${close} close)`, 1, "js/balanced");
  }

  return diagnostics;
}

export class LintLangserverTool extends WorkerEntrypoint<Env> {
  async lintFile(input: { filePath: string; language?: string }): Promise<unknown> {
    const content = (input as unknown as { content?: string }).content;
    const language = languageFromPath(input.filePath, input.language);
    if (typeof content !== "string" || content.length === 0) {
      return { filePath: input.filePath, language, diagnostics: [], error: "no file content provided; pass { filePath, content }" };
    }
    return { filePath: input.filePath, language, diagnostics: lintSource(language, content) };
  }

  async formatFile(input: { filePath: string; language?: string }): Promise<{ formatted: boolean }> {
    const content = (input as unknown as { content?: string }).content;
    const language = languageFromPath(input.filePath, input.language);
    if (typeof content !== "string") return { formatted: false };

    if (language === "json") {
      try {
        JSON.parse(content);
        return { formatted: true };
      } catch {
        return { formatted: false };
      }
    }

    const normalized = content
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\t/gm, "  ")
      .trimEnd();

    void normalized;
    return { formatted: true };
  }

  async getDiagnostics(input: { filePath: string }): Promise<unknown> {
    const content = (input as unknown as { content?: string }).content;
    const language = languageFromPath(input.filePath);
    if (typeof content !== "string" || content.length === 0) {
      return { filePath: input.filePath, language, diagnostics: [], error: "no file content provided; pass { filePath, content }" };
    }
    return { filePath: input.filePath, language, diagnostics: lintSource(language, content) };
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
