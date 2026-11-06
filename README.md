# Chesser

Instant browser chess rooms with no account required.

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

## Project Layout

```text
backend/       Express and Socket.IO room server
frontend/      React and Vite client
scripts/dev.js Starts and cleans both development services
```

Room state currently lives in backend memory, so active rooms disappear when the server restarts.

## Checks

Build the frontend with:

```bash
npm run build
```
