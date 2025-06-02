import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define interface for Cloudflare Worker environment
export interface Env {
  // Define your environment variables here
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Authless Calculator",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);
		this.server.tool(
			"get_trending_repos",
			{},
			async () => {
				const res = await fetch("https://github.com/trending");

				if (!res.ok) {
				return {
					content: [
					{
						type: "text",
						text: `❌ Failed to fetch GitHub Trending page. Status: ${res.status}`,
					},
					],
				};
				}

				const html = await res.text();

				const repoBlocks = [...html.matchAll(/<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g)];
				const topRepos: string[] = [];

				for (let i = 0; i < Math.min(10, repoBlocks.length); i++) {
				const block = repoBlocks[i][1];

				const nameMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="\/([\w.-]+\/[\w.-]+)"/);
				const name = nameMatch ? nameMatch[1] : "unknown/repo";
				const link = `https://github.com/${name}`;

				const descMatch = block.match(/<p[^>]*>(.*?)<\/p>/s);
				let desc = descMatch
					? descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
					: "No description provided.";

				if (desc.length > 80) {
					desc = desc.slice(0, 77) + "...";
				}

				topRepos.push(`**${i + 1}. [${name}](${link})**\n${desc}`);
				}

				const message = `**🔥 Top Trending GitHub Repos Today**\n\n${topRepos.join("\n\n")}`;

				return {
				content: [
					{
					type: "text",
					text: message,
					},
				],
				};
			}
			);


		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
