# Chesser

Instant browser chess rooms with no account required.

## What It Does

- Create a private room and share its URL.
- Join a room as White or Black, or watch an active game.
- Play against a second browser or the built-in computer opponent.
- Use clocks, increments, draw offers, resignation, rematches, and legal-move highlights.
- Choose a chess mode from the match setup screen. Variant metadata is stored with rooms; the current move engine still uses standard chess rules.

## Requirements

- Node.js 18 or newer
- npm

## Run Locally

Install dependencies in the root, backend, and frontend directories:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

Start both services from the project root:

```bash
npm run dev
```

Then open [http://localhost:4173/](http://localhost:4173/).

The frontend runs on port `4173` and the Socket.IO backend runs on port `3001`. The root dev script clears stale listeners on those ports before starting both services.

## How To Play

1. Choose **Vs player** or **Vs computer**.
2. Select your color and time control.
3. Create a room, then copy the generated room URL to invite someone.
4. Select a piece to see its legal destinations, then click or drag to move it.

After a game ends, either player can offer a rematch. The other player must accept before the board resets.

## Project Layout

```text
backend/       Express and Socket.IO room server
frontend/      React and Vite client
scripts/dev.js Starts and cleans both development services
```

Room state currently lives in backend memory, so active rooms disappear when the server restarts. No account or database is required for the MVP.

## Checks

Build the frontend with:

```bash
npm run build
```
