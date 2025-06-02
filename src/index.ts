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
						text: "Error: Failed to fetch GitHub trending repositories",
					},
					],
				};
				}

				const html = await res.text();

				const repoMatches = [...html.matchAll(/<h2 class="h3[^>]*>.*?<a href="\/([^"]+)"/g)];

				const repos = repoMatches
				.slice(0, 10)
				.map((match, index) => `${index + 1}. ${match[1]}`);

				if (repos.length === 0) {
				return {
					content: [
					{
						type: "text",
						text: "No trending repositories found. GitHub may have updated their layout.",
					},
					],
				};
				}

				return {
				content: [
					{
					type: "text",
					text: `Top 10 Trending GitHub Repositories:\n\n${repos.join("\n")}`,
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
