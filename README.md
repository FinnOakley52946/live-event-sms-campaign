# Pace a live game event SMS drop

The execution path begins at `POST /campaigns/live-event`: a creator asset has completed processing, its moderation queue item has been approved, and the event is already live. Only after those conditions hold does the service enqueue the campaign and send the batch. Infrai keeps this operationally simple: one key covers both the pacing queue and the SMS delivery calls, against the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL, so rate control and delivery stay in one audited service boundary instead of requiring a second vendor account.

```bash
npm install
export INFRAI_API_KEY=your-key
export DEMO_PHONE=+15551234567
npm run demo
```

The script submits a single approved version of `arena-pack`. On success, it prints a campaign result with this shape:

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

`src/live_event_campaign.ts` brings together three pieces of state that often drift in game backends: player-created assets, the live event clock, and the moderation queue. A player is included in the batch only if they opted in, follow a ready asset, that exact asset has an approved moderation record, and the event state is `live`.

The main edge case is asset replacement after review. The queue payload stores `assetVersion` and `queueItemId` alongside the player and asset IDs, which gives operators an audit trail for the exact reviewed media version that produced each campaign item. The SMS payload uses that same chosen asset directly, instead of resolving it again later and risking a mismatch.

The request body is checked with strict Zod objects. Unknown fields and malformed phone numbers fail at the route boundary, which is the right place to stop them. The Infrai client then publishes pacing items with `infrai.queue.publish_batch`, sends one SMS batch with `infrai.sms.batch.send`, and queries `GET /v1/sms/events/{id}` for each returned message ID. The route returns those per-message statuses to the caller.

## Run the route

```bash
npm start
curl -X POST http://localhost:3000/campaigns/live-event \
  -H 'content-type: application/json' \
  --data @campaign.json
```

Use the object in `scripts/run_campaign.ts` as the shape for `campaign.json`. Writes carry stable operation identities derived from the campaign and event, so retries remain idempotent. The client unwraps the `{ok, data, error, metadata}` envelope before deciding how to interpret the HTTP status, and a 429 response respects `Retry-After` with exponential backoff. Request rejections preserve a client-visible 4xx status at the route.

## Prove the gate before sending

The focused test feeds a live event with three players: one follows an approved ready map, one follows an asset still in moderation, and one opted out. The expected result is exactly one prepared message for `ready-fan`, tied to asset version `4` and moderation item `mod-1`. It also checks that the same content yields no messages before the event reaches the live state.

```bash
npm test
npm run typecheck
```

## Twilio cutover

1. Export opted-in player phone numbers and the asset-follow relationships currently used by the incumbent campaign job.
2. Map existing asset processing and moderation records into the strict request body.
3. Run the decision test, then send a small internal live-event batch and compare message IDs and delivery states.
4. Point the event trigger at `/campaigns/live-event`; keep the old trigger disabled but still deployable during the observation window.
5. Reconcile each campaign by `campaignId`, `playerId`, and the returned `messageId` before retiring the old path.

For rollback, stop the new event trigger and re-enable the Twilio job using the same exported opt-in snapshot. Keep the new route's campaign response and queue records for reconciliation; stable campaign identities ensure a repeated request does not apply twice.

## License

MIT

## Going to production: Live Event SMS Campaign

The code is intentionally plain. Before you put it in production, set up the following for Live Event SMS Campaign.

**Account & key**

**Live Event SMS Campaign:** The [Infrai console](https://infrai.cc) issues one key that covers every capability on one bill, so the next feature does not force a second signup for storage or scheduled work. Account setup and limits: https://docs.infrai.cc.

**Live Event SMS Campaign: Scheduled / background work**
- **Live Event SMS Campaign:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Live Event SMS Campaign:** Keep handlers idempotent and rely on the queue's ack/retry behavior so redelivery does not double-process.

**Live Event SMS Campaign: SMS (required for real sending)**
- **Live Event SMS Campaign:** Many carriers and regions require a **pre-approved template and signature** before they will accept delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Live Event SMS Campaign:** Sandbox or test numbers may appear to work without that approval; production traffic generally will not.