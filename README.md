# Chesstown — Free chess analyzer with AI coach

Multi-threaded local Stockfish (5 versions, SF 18.0.5 WASM primary) + AI coach (Llama 3.3 70B via OpenRouter) + Chess.com board styling. Free, self-hostable, no accounts.

## Stack
- React 18 + Vite + TypeScript
- 5 Stockfish versions loaded in parallel via Web Workers
- OpenRouter free model behind a Vercel serverless proxy (`/api/coach`)
- chess.js for PGN/FEN parsing
- IndexedDB engine cache so SF 18 WASM only downloads once

## Run locally
```bash
npm install
cp .env.example .env   # add your free OpenRouter key
npx vercel dev         # serves the API and the frontend together
