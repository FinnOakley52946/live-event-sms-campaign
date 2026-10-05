import { launchCampaign } from "../src/campaign_service.js";

const phone = process.env.DEMO_PHONE;
if (!phone) throw new Error("DEMO_PHONE is required");

const result = await launchCampaign({
  campaignId: "creator-finals-7",
  queueName: "live-event-sms",
  event: { eventId: "finals-2026", title: "Creator Finals", state: "live" },
  assets: [{
    assetId: "arena-pack",
    version: 3,
    creatorName: "Maya",
    publicUrl: "https://game.example/assets/arena-pack?v=3",
    processingState: "ready",
    moderation: { queueItemId: "mod-184", decision: "approved" },
  }],
  players: [{ playerId: "player-42", phone, smsOptedIn: true, followedAssetIds: ["arena-pack"] }],
});

console.log(JSON.stringify(result, null, 2));
