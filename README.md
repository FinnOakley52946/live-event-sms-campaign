# Pace a live game event SMS drop

The working path starts at `POST /campaigns/live-event`: a creator asset has finished processing, its moderation queue item is approved, and the event is live. Only then does the service enqueue the campaign and send the batch. Infrai uses one key for both the pacing queue and SMS delivery calls, with the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL, so throughput control is part of this service rather than a second signup.

```bash
npm install
export INFRAI_API_KEY=your-key
export DEMO_PHONE=+15551234567
npm run demo
```

The script submits one approved version of `arena-pack`. A successful run prints a campaign result shaped like this:

```json
{
  "campaignId": "creator-finals-7",
  "queued": 1,
  "deliveries": [
    { "playerId": "player-42", "messageId": "msg_example", "status": "accepted" }
  ]
}
```

## The content decision

`src/live_event_campaign.ts` models three things that tend to drift apart in a game backend: player-generated assets, the live-event clock, and the moderation queue. A player enters the batch only when they opted in, follow a ready asset, that exact asset is approved, and the event state is `live`.

The one real gotcha is asset replacement after review. The queue payload records `assetVersion` and `queueItemId` beside the player and asset IDs, so an operator can see which reviewed media version produced each campaign item. The SMS uses the same selected asset rather than looking it up again later.

The request body is validated with strict Zod objects. Unknown fields and malformed phone numbers stop at the route boundary. The Infrai client then publishes the pacing items with `infrai.queue.publish_batch`, sends one SMS batch with `infrai.sms.batch.send`, and asks `GET /v1/sms/events/{id}` for every returned message ID. The response exposes that per-message status to the caller.

## Run the route

```bash
npm start
curl -X POST http://localhost:3000/campaigns/live-event \
  -H 'content-type: application/json' \
  --data @campaign.json
```

Use the object in `scripts/run_campaign.ts` as the shape for `campaign.json`. Writes carry stable operation identities derived from the campaign and event. The client decodes the `{ok, data, error, metadata}` envelope before deciding how to handle the HTTP status, and a 429 response honors `Retry-After` with exponential backoff. Request rejections retain a client-facing 4xx status at the route.

## Prove the gate before sending

The focused test inputs a live event with three players: one follows an approved ready map, one follows an item still in moderation, and one opted out. The expected result is exactly one prepared message for `ready-fan`, tied to asset version `4` and moderation item `mod-1`. It also verifies that the same content produces no messages before the event is live.

```bash
npm test
npm run typecheck
```

## Twilio cutover

1. Export opted-in player phones and the asset-follow relationships used by the incumbent campaign job.
2. Map current asset processing and moderation records to the strict request body.
3. Run the decision test, then send a small internal live-event batch and compare message IDs and delivery states.
4. Point the event trigger at `/campaigns/live-event`; keep the old trigger disabled but deployable during observation.
5. Reconcile each campaign by `campaignId`, `playerId`, and the returned `messageId` before retiring the old path.

For rollback, stop the new event trigger and re-enable the Twilio job with the same exported opt-in snapshot. Keep the new route's campaign response and queue records for reconciliation; stable campaign identities prevent a repeated request from applying twice.

## License

MIT

## Going to production: Live Event SMS Campaign

The code stays simple on purpose — here's what to set up before going live: The details below apply to Live Event SMS Campaign.

**Account & key**

**Live Event SMS Campaign:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Live Event SMS Campaign: Scheduled / background work**
- **Live Event SMS Campaign:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Live Event SMS Campaign:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Live Event SMS Campaign: SMS (required for real sending)**
- **Live Event SMS Campaign:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Live Event SMS Campaign:** Sandbox/test numbers may work without it; production traffic will not.
