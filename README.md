# Chesser

Instant browser chess rooms with no account required.

## What It Does

- Create a private room and share its URL.
- Join a room as White or Black, or watch an active game.
- Play against a second browser or the built-in computer opponent.
- Use clocks, increments, draw offers, resignation, rematches, and legal-move highlights.
- Choose a chess mode from the match setup screen. Variant metadata is stored with rooms; the current move engine still uses standard chess rules.

## Decisions and Lessons Learned

A few important trade-offs shaped this project. I kept the room model simple and in-memory so the app stays easy to run locally and avoids the extra complexity of accounts, persistence, and database setup for an MVP. I also chose a lightweight real-time architecture with Socket.IO and browser-based room links because the core goal was instant play without friction, not building a large multiplayer platform from day one.

I had to decide what to prioritize for user experience: legal-move highlighting, time controls, draw/resign flows, and quick rematches all make the game feel polished and reduce confusion, especially in a browser-first chess app. I also made the match setup screen flexible enough to support variants in the future, even though the actual move validation still follows standard chess rules for now. That keeps the codebase extensible without forcing a full rewrite of the engine or room model.

The biggest lesson was that real-time game projects are as much about state management and UX as they are about chess logic. Keeping room state predictable, making flows obvious, and reducing setup friction mattered just as much as getting moves to work correctly. I also learned that defining a clear scope early is important: it is much easier to add features later when the foundation is intentionally simple and well-structured.

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
