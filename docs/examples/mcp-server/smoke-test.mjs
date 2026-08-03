// Minimal MCP client that drives the server over stdio and prints results.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(__dirname, "server.mjs")],
});
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const list = await client.callTool({ name: "list_plugins", arguments: {} });
const plugins = JSON.parse(list.content[0].text);
console.log("PLUGIN COUNT:", plugins.length);
console.log("SAMPLE:", JSON.stringify(plugins[0]));

const got = await client.callTool({
  name: "get_plugin",
  arguments: { api_name: plugins[0].api_name },
});
console.log("GET_PLUGIN first line:", got.content[0].text.split("\n")[0]);

const search = await client.callTool({
  name: "search_plugins",
  arguments: { query: "config_template", max_results: 3 },
});
console.log("SEARCH header:", search.content[0].text.split("\n")[0]);

const method = await client.callTool({
  name: "find_method",
  arguments: { method: "showToast" },
});
console.log("FIND_METHOD header:", method.content[0].text.split("\n")[0]);

const dotted = await client.callTool({
  name: "find_method",
  arguments: { method: "communicate.runFrameScript" },
});
console.log("FIND_METHOD dotted:", dotted.content[0].text.split("\n")[0]);

const badre = await client.callTool({
  name: "find_method",
  arguments: { method: "(unclosed", mode: "regex" },
});
console.log("FIND_METHOD bad regex isError:", badre.isError);

const bad = await client.callTool({
  name: "get_plugin",
  arguments: { api_name: "does_not_exist" },
});
console.log("BAD isError:", bad.isError, "->", bad.content[0].text.slice(0, 60));

const res = await client.listResources();
console.log("RESOURCE COUNT:", res.resources.length, "e.g.", res.resources[0]?.uri);

await client.close();
console.log("OK");
