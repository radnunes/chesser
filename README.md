# Chesser

Instant browser chess rooms with no account required.

## What It Does

- Create a private room and share its URL.
- Join a room as White or Black, or watch an active game.
- Play against a second browser or the built-in computer opponent.
- Use clocks, increments, draw offers, resignation, rematches, and legal-move highlights.
- Choose a chess mode from the match setup screen. Variant metadata is stored with rooms; the current move engine still uses standard chess rules.

## Decisions and Lessons Learned

A few important choices shaped this project. I kept the game rooms simple and stored them in memory so the app is easy to run locally and does not need accounts, a database, or extra setup for an early version. I also chose a lightweight real-time setup with Socket.IO and browser-based room links because the main goal was to make it easy to start a game quickly, not to build a large multiplayer platform from day one.

I had to decide what mattered most for the player experience. Things like showing legal moves, time controls, draw and resign options, and quick rematches make the game feel smoother and easier to understand. I also set up the match screen so it can support different chess variants later, even though the actual rules for moves still follow standard chess for now. That gives the project room to grow without rewriting the whole setup.

The biggest lesson was that real-time games are not just about chess rules. They are also about keeping the game state consistent, making the flow obvious, and reducing friction for the user. I learned that it is better to keep the first version focused and simple, because it is much easier to add features later when the foundation is solid.

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
