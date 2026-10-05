import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_campaign.js";
import { launchCampaign } from "./campaign_service.js";

const port = Number(process.env.PORT ?? 3000);

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/campaigns/live-event") {
    json(response, 404, { error: "route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const result = await launchCampaign(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    json(response, 202, result);
  } catch (error) {
    if (error instanceof ZodError) {
      json(response, 400, { error: "invalid campaign", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      json(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.detail ?? { message: error.message },
      });
      return;
    }
    json(response, 500, { error: error instanceof Error ? error.message : "unexpected error" });
  }
}).listen(port, () => console.log(`Campaign service listening on http://localhost:${port}`));
