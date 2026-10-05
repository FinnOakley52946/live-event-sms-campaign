import { infrai } from "./infrai_campaign.js";
import { campaignSchema, prepareMessages } from "./live_event_campaign.js";

export async function launchCampaign(raw: unknown) {
  const input = campaignSchema.parse(raw);
  const messages = prepareMessages(input);
  const operationId = `campaign:${input.campaignId}:${input.event.eventId}`;

  if (messages.length === 0) {
    return { campaignId: input.campaignId, queued: 0, deliveries: [] };
  }

  await infrai.queue.publish_batch({
    queue: input.queueName,
    messages: messages.map((message) => ({
      payload: {
        campaignId: input.campaignId,
        playerId: message.playerId,
        assetId: message.assetId,
        assetVersion: message.assetVersion,
        queueItemId: message.queueItemId,
      },
    })),
    idempotency_key: `${operationId}:pace`,
  });

  const sent = await infrai.sms.batch.send({
    messages: messages.map(({ to, text }) => ({ to, text })),
    idempotency_key: `${operationId}:send`,
  });

  const deliveries = await Promise.all(sent.results.map(async (result, index) => {
    const eventData = await infrai.sms.events(result.message_id);
    const latest = eventData.events?.at(-1)?.status ?? eventData.status ?? "accepted";
    return {
      playerId: messages[index]?.playerId ?? "unknown",
      messageId: result.message_id,
      status: latest,
    };
  }));

  return { campaignId: input.campaignId, queued: messages.length, deliveries };
}
