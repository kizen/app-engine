#!/usr/bin/env node
// MCP server exposing Kizen plugin reference docs to agents.
//
// It serves the generated `<plugin>.md` reports that live in the examples
// directory (the `.html` siblings are human-only and are ignored). Agents
// retrieve selectively via tools instead of loading every report into context:
//
//   list_plugins              -> the menu: name, version, one-line description
//   get_plugin(api_name)      -> full markdown for one plugin
//   search_plugins(query)     -> grep across all reports, with line context
//
// Each plugin is also published as an MCP resource (kizen-plugin://<api_name>)
// so resource-aware clients can browse and attach them natively.
//
// The examples directory defaults to the parent of this file; override with
// the KIZEN_EXAMPLES_DIR environment variable.

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR =
  process.env.KIZEN_EXAMPLES_DIR || path.resolve(__dirname, "..");

// ---- data access -----------------------------------------------------------

// Prose that lives alongside the reports and is not itself a report. Without
// this, the examples directory's own index would be served as a plugin named
// "README". Add any further hand-written markdown here.
const NON_REPORT_FILES = new Set(["README.md"]);

/** List the api_names (filename without .md) of every plugin report. */
async function listApiNames() {
  const entries = await readdir(EXAMPLES_DIR, { withFileTypes: true });
  return entries
    .filter(
      (e) =>
        e.isFile() && e.name.endsWith(".md") && !NON_REPORT_FILES.has(e.name),
    )
    .map((e) => e.name.slice(0, -3))
    .sort();
}

function reportPath(apiName) {
  // Guard against path traversal: api_name must be a bare filename.
  const safe = path.basename(apiName, ".md");
  return path.join(EXAMPLES_DIR, `${safe}.md`);
}

async function readReport(apiName) {
  return readFile(reportPath(apiName), "utf8");
}

/** Pull name, version, and a one-line description from a report's text. */
function parseMeta(apiName, text) {
  const lines = text.split("\n");
  let name = apiName;
  let version = null;

  const heading = lines.find((l) => l.startsWith("# "));
  if (heading) {
    const m = heading.match(/^#\s+(.*?)(?:\s+v([\d.]+\S*))?\s*$/);
    if (m) {
      name = m[1].trim() || apiName;
      version = m[2] || null;
    }
  }

  // Prefer the kizen.json "description"; fall back to the first prose line
  // after the heading.
  let description = "";
  const descMatch = text.match(/"description"\s*:\s*"([^"]*)"/);
  if (descMatch && descMatch[1].trim()) {
    description = descMatch[1].trim();
  } else if (heading) {
    const idx = lines.indexOf(heading);
    for (let i = idx + 1; i < Math.min(idx + 6, lines.length); i++) {
      const l = lines[i].trim();
      if (l && !l.startsWith("#") && !l.startsWith("```")) {
        description = l;
        break;
      }
    }
  }

  return { api_name: apiName, name, version, description };
}

// ---- server -----------------------------------------------------------------

const server = new McpServer(
  { name: "kizen-plugin-reference", version: "0.1.0" },
  {
    instructions:
      "Reference docs for example Kizen plugins. Call list_plugins to see " +
      "what's available, get_plugin to read one plugin's full implementation " +
      "(kizen.json + file tree + source), and search_plugins to find which " +
      "plugins demonstrate a given API or pattern. Use these before building " +
      "plugin app features so generated code matches real, working examples.",
  },
);

server.tool(
  "list_plugins",
  "List every example plugin with its name, version, and one-line description. " +
    "Start here to discover which reference is relevant.",
  {},
  async () => {
    const apiNames = await listApiNames();
    const metas = await Promise.all(
      apiNames.map(async (n) => parseMeta(n, await readReport(n))),
    );
    return {
      content: [{ type: "text", text: JSON.stringify(metas, null, 2) }],
    };
  },
);

server.tool(
  "get_plugin",
  "Return the full reference markdown for one plugin (kizen.json config, file " +
    "tree, and complete source of every file). Pass the api_name from list_plugins.",
  { api_name: z.string().describe("Plugin api_name, e.g. 'kizen_ai'") },
  async ({ api_name }) => {
    const available = await listApiNames();
    if (!available.includes(path.basename(api_name, ".md"))) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown plugin '${api_name}'. Available: ${available.join(", ")}`,
          },
        ],
      };
    }
    const text = await readReport(api_name);
    return { content: [{ type: "text", text }] };
  },
);

server.tool(
  "search_plugins",
  "Case-insensitive search across all plugin reports. Returns matching lines " +
    "with surrounding context, grouped by plugin — use it to find which plugins " +
    "use a given API, field type, or pattern.",
  {
    query: z.string().describe("Text or substring to search for"),
    context: z
      .number()
      .int()
      .min(0)
      .max(10)
      .optional()
      .describe("Lines of context around each match (default 2)"),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Max matching lines to return across all plugins (default 50)"),
  },
  async ({ query, context = 2, max_results = 50 }) => {
    const needle = query.toLowerCase();
    const apiNames = await listApiNames();
    const blocks = [];
    let total = 0;

    for (const apiName of apiNames) {
      if (total >= max_results) break;
      const lines = (await readReport(apiName)).split("\n");
      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        if (total >= max_results) break;
        if (lines[i].toLowerCase().includes(needle)) {
          const start = Math.max(0, i - context);
          const end = Math.min(lines.length - 1, i + context);
          const snippet = lines
            .slice(start, end + 1)
            .map((l, k) => `${start + k + 1}: ${l}`)
            .join("\n");
          hits.push(`  [line ${i + 1}]\n${snippet}`);
          total++;
        }
      }
      if (hits.length) {
        blocks.push(
          `### ${apiName} (${hits.length} match(es))\n${hits.join("\n  ---\n")}`,
        );
      }
    }

    const header = blocks.length
      ? `Found matches in ${blocks.length} plugin(s) for "${query}"` +
        (total >= max_results ? ` (truncated at ${max_results} lines)` : "")
      : `No matches for "${query}".`;
    return {
      content: [{ type: "text", text: `${header}\n\n${blocks.join("\n\n")}` }],
    };
  },
);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

server.tool(
  "find_method",
  "Find which plugins call/use a specific method, function, or symbol. Unlike " +
    "search_plugins (raw substring grep), this is symbol-aware and returns a " +
    "plugin-ranked summary with example call sites. A bare name like 'showToast' " +
    "also matches dotted calls like 'this.showToast(' or 'x.showToast('.",
  {
    method: z
      .string()
      .describe(
        "Method/function/symbol to find, e.g. 'showToast' or 'communicate.runFrameScript'",
      ),
    mode: z
      .enum(["call", "any", "regex"])
      .optional()
      .describe(
        "call (default): require '(' after the name; any: bare identifier; regex: treat `method` as a raw regex",
      ),
    ignore_case: z
      .boolean()
      .optional()
      .describe("Case-insensitive (default false)"),
    max_examples: z
      .number()
      .int()
      .min(0)
      .max(20)
      .optional()
      .describe("Example call sites to show per plugin (default 3)"),
  },
  async ({ method, mode = "call", ignore_case = false, max_examples = 3 }) => {
    let pattern;
    if (mode === "regex") {
      pattern = method;
    } else {
      const esc = escapeRegExp(method);
      // Reject a name preceded by an identifier char so 'showToast' doesn't
      // match 'myshowToast', but a leading '.' (this.showToast) still matches.
      pattern =
        mode === "call"
          ? `(?<![A-Za-z0-9_])${esc}\\s*\\(`
          : `(?<![A-Za-z0-9_])${esc}(?![A-Za-z0-9_])`;
    }

    let re;
    try {
      re = new RegExp(pattern, ignore_case ? "i" : "");
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: `Invalid pattern: ${e.message}` }],
      };
    }

    const apiNames = await listApiNames();
    const results = [];
    let grandTotal = 0;

    for (const apiName of apiNames) {
      const text = await readReport(apiName);
      const lines = text.split("\n");
      const examples = [];
      let count = 0;
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          count++;
          if (examples.length < max_examples) {
            examples.push(`    ${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
      if (count > 0) {
        const meta = parseMeta(apiName, text);
        results.push({ apiName, name: meta.name, count, examples });
        grandTotal += count;
      }
    }

    results.sort((a, b) => b.count - a.count);

    if (!results.length) {
      return {
        content: [
          {
            type: "text",
            text: `No plugin matches '${method}' (mode: ${mode}).`,
          },
        ],
      };
    }

    const body = results
      .map(
        (r) =>
          `### ${r.apiName} — ${r.name} (${r.count} use(s))\n${r.examples.join("\n")}` +
          (r.count > r.examples.length
            ? `\n    … ${r.count - r.examples.length} more`
            : ""),
      )
      .join("\n\n");
    const header = `'${method}' (mode: ${mode}) used in ${results.length} plugin(s), ${grandTotal} total site(s):`;
    return { content: [{ type: "text", text: `${header}\n\n${body}` }] };
  },
);

// ---- resources --------------------------------------------------------------
// One resource per plugin so resource-aware clients can list and read them.

server.resource(
  "plugin-report",
  new ResourceTemplate("kizen-plugin://{api_name}", {
    list: async () => {
      const apiNames = await listApiNames();
      const metas = await Promise.all(
        apiNames.map(async (n) => parseMeta(n, await readReport(n))),
      );
      return {
        resources: metas.map((m) => ({
          uri: `kizen-plugin://${m.api_name}`,
          name: `${m.name}${m.version ? ` v${m.version}` : ""}`,
          description: m.description || `Reference for ${m.api_name}`,
          mimeType: "text/markdown",
        })),
      };
    },
  }),
  async (uri, { api_name }) => {
    const text = await readReport(api_name);
    return {
      contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
    };
  },
);

// ---- boot -------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[kizen-plugin-reference] serving reports from ${EXAMPLES_DIR}`);
