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
			"get_weather",
			{},
			async () => {
				const latitude = 37.7749; // Example latitude
				const longitude = -122.4194; // Example longitude
				
				const res= await fetch(
					`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    			);

				if (!res.ok) {
					return {
						content: [
							{
								type: "text",
								text: "Error: Failed to fetch weather data",
							},
						],
					};
				}

				const data = (await res.json()) as {
				current_weather: {
					temperature: number;
					windspeed: number;
					weathercode: number;
				};
				};

    const weather = data.current_weather;
				return {
					content: [
						{
							type: "text",
							text: `Current weather in Windsor, Ontario: ${weather.temperature}°C, with wind speed of ${weather.windspeed} km/h.`,
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
