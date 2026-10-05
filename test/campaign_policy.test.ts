import assert from "node:assert/strict";
import test from "node:test";
import { campaignSchema, prepareMessages } from "../src/live_event_campaign.js";

const campaign = {
  campaignId: "finals-drop",
  queueName: "campaign-pace",
  event: { eventId: "finals", title: "Creator Finals", state: "live" },
  assets: [
    { assetId: "approved-map", version: 4, creatorName: "Maya", publicUrl: "https://game.example/a/approved-map?v=4", processingState: "ready", moderation: { queueItemId: "mod-1", decision: "approved" } },
    { assetId: "pending-skin", version: 2, creatorName: "Leon", publicUrl: "https://game.example/a/pending-skin?v=2", processingState: "ready", moderation: { queueItemId: "mod-2", decision: "pending" } },
  ],
  players: [
    { playerId: "ready-fan", phone: "+15551230001", smsOptedIn: true, followedAssetIds: ["approved-map"] },
    { playerId: "pending-fan", phone: "+15551230002", smsOptedIn: true, followedAssetIds: ["pending-skin"] },
    { playerId: "opted-out", phone: "+15551230003", smsOptedIn: false, followedAssetIds: ["approved-map"] },
  ],
} as const;

test("only opted-in players following an approved ready asset enter the live campaign", () => {
  const messages = prepareMessages(campaignSchema.parse(campaign));
  assert.equal(messages.length, 1);
  assert.deepEqual(
    { playerId: messages[0]?.playerId, assetVersion: messages[0]?.assetVersion, queueItemId: messages[0]?.queueItemId },
    { playerId: "ready-fan", assetVersion: 4, queueItemId: "mod-1" },
  );
  assert.match(messages[0]?.text ?? "", /Creator Finals/);
});

test("a scheduled event produces no campaign messages", () => {
  const input = campaignSchema.parse({ ...campaign, event: { ...campaign.event, state: "scheduled" } });
  assert.deepEqual(prepareMessages(input), []);
});
