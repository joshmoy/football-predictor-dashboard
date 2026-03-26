# Goborr Dashboard

This is a separate Next.js dashboard app that talks to the FastAPI backend in the sibling
`goborr-ai` folder.

## Setup

1. Copy `.env.local.example` to `.env.local`
2. Copy `.env.local.example` to `.env.local`
3. Run `npm install`
4. Run `npm run dev`

By default the app expects this layout:

- `/Users/joshua/Desktop/goborr-dashboard`
- `/Users/joshua/Desktop/goborr-ai`

The frontend calls the backend at `http://127.0.0.1:8000/predict` by default.
If your backend lives elsewhere, update `NEXT_PUBLIC_PREDICTOR_API_URL` in `.env.local`.
