# AI Calling Frontend — bhavsarparth

Client-facing dashboard for the AI calling agent. Provider branding is hidden from the UI.

## Run locally

```bash
cd ai-calling-frontend
npm install
npm run dev
```

App opens at **http://localhost:3002**

## Config

Copy `.env.example` → `.env` and set token / API base (see `.env.example`).

## Current features

- **Test Call** — place outbound SIP test calls with caller ID, routing rule, metadata
- **Call History** — SIP call list with search, type filter, pagination
- **Rooms** — rooms list with pagination + copy room ID
- **Sessions** — session list, room filter, detail drawer with participants
- **Recordings** — participant, track, and session recordings with room/session filters and playback

## Coming soon

- Sessions, Recordings, Overview, customer pricing UI
