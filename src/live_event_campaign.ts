import { z } from "zod";

const phone = z.string().regex(/^\+[1-9]\d{7,14}$/);

export const campaignSchema = z.object({
  campaignId: z.string().trim().min(1).max(80),
  queueName: z.string().trim().min(1).max(80),
  event: z.object({
    eventId: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(80),
    state: z.enum(["scheduled", "live", "ended"]),
  }).strict(),
  assets: z.array(z.object({
    assetId: z.string().trim().min(1).max(80),
    version: z.number().int().positive(),
    creatorName: z.string().trim().min(1).max(60),
    publicUrl: z.string().url(),
    processingState: z.enum(["processing", "ready"]),
    moderation: z.object({
      queueItemId: z.string().trim().min(1).max(80),
      decision: z.enum(["pending", "approved", "rejected"]),
    }).strict(),
  }).strict()).min(1).max(100),
  players: z.array(z.object({
    playerId: z.string().trim().min(1).max(80),
    phone,
    smsOptedIn: z.boolean(),
    followedAssetIds: z.array(z.string()).max(20),
  }).strict()).min(1).max(500),
}).strict();

export type CampaignInput = z.infer<typeof campaignSchema>;

export type PreparedMessage = {
  playerId: string;
  assetId: string;
  assetVersion: number;
  queueItemId: string;
  to: string;
  text: string;
};

export function prepareMessages(input: CampaignInput): PreparedMessage[] {
  if (input.event.state !== "live") return [];

  const eligibleAssets = new Map(
    input.assets
      .filter((asset) => asset.processingState === "ready" && asset.moderation.decision === "approved")
      .map((asset) => [asset.assetId, asset]),
  );

  return input.players.flatMap((player) => {
    if (!player.smsOptedIn) return [];
    const asset = player.followedAssetIds.map((id) => eligibleAssets.get(id)).find(Boolean);
    if (!asset) return [];
    return [{
      playerId: player.playerId,
      assetId: asset.assetId,
      assetVersion: asset.version,
      queueItemId: asset.moderation.queueItemId,
      to: player.phone,
      text: `${asset.creatorName}'s ${asset.assetId} is live in ${input.event.title}: ${asset.publicUrl}`,
    }];
  });
}
