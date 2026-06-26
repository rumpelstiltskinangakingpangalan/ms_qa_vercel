# MS QA — Design Review

A Next.js (App Router, TypeScript) port of the Magic Story **Design Review** QA
tool. It loads a personalized children's book from Supabase and lets a reviewer
page through the cover and spreads, magnify artwork, swap/download images, leave
per-page notes, mark favorites, and inspect the avatar reference — all of the
behavior from the original `html-css-js` prototype, rebuilt as a deployable app.

## Features

- **Cover + page spreads** with progressive image loading and personalized text overlays.
- **Zoom lens** (`~`) — a magnifier that follows the cursor over any artwork.
- **Avatar view** (`A`) — the child/companion reference images and the current page reference.
- **Shade** (`S`) — toggle the text gradient on the focused page.
- **Download / Upload / Reset image** (`D` / `F` / `R`) with aspect-ratio + resolution validation on upload.
- **Notes** — right-click a page → *Edit Notes*; Solve/Save persist to Supabase.
- **Favorites** — star pages; persisted to Supabase.
- **Page navigation dropdown**, **settings** (Filler Pages / Text Pages / Hotkeys), **copy order ID** (`C`).

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [@supabase/supabase-js](https://supabase.com/docs/reference/javascript) for data

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

The Supabase URL and **anon** key (browser-safe) are read from env vars, with
the original project's values kept as a fallback so the app runs with no setup.
To target a different Supabase project, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The app expects these tables keyed by `book_id`: `table_book_main`,
`table_avatars`, `table_pages`, `table_favorites`, `table_notes`. The reviewed
book is selected by the `BOOK_ID` constant in `app/page.tsx`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Deploy to GitHub + Vercel

1. **Push to GitHub** (from this folder):

   ```bash
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/Ozydeus/ms_qa_vercel.git
   git push -u origin main
   ```

2. **Import on Vercel**: go to [vercel.com/new](https://vercel.com/new), pick the
   repo. Vercel auto-detects Next.js — no build settings needed.

3. **(Optional) Env vars**: in Vercel → Project → Settings → Environment
   Variables, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   if you want to override the defaults. Then **Deploy**.

## Project structure

```
app/
  layout.tsx       Root layout + Google Fonts
  page.tsx         Main client component (all UI + logic)
  icons.tsx        Inline SVG icon components
  globals.css      Ported styles
lib/
  supabaseClient.ts  Supabase browser client
  bookData.ts        Per-book content (text/cover/page references)
```
