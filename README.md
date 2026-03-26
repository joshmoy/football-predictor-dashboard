# Goborr Dashboard

This is a separate Next.js dashboard app that talks to the Python model in the sibling
`goborr-ai` folder.

## Setup

1. Copy `.env.local.example` to `.env.local`
2. Run `npm install`
3. Run `npm run dev`

By default the app expects this layout:

- `/Users/joshua/Desktop/goborr-dashboard`
- `/Users/joshua/Desktop/goborr-ai`

The API route shells into the Python predictor at `/Users/joshua/Desktop/goborr-ai/main.py`.
If your layout changes, update `FOOTBALL_MODEL_ROOT` in `.env.local`.
