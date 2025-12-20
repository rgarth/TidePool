# 🌊 TidePool

**Collaborative playlist generator for Tidal**

TidePool lets you build playlists together. The host creates a session, everyone joins with a code, and anyone can search and add songs to a shared Tidal playlist.

## Features

- 🎵 **Collaborative Playlists** — Everyone can add songs in real-time
- 🔍 **Tidal Search** — Search the full Tidal catalog
- 📋 **Use Existing Playlists** — Start from one of your playlists or create new
- 📱 **Easy Sharing** — QR code or share link to invite others
- 🎧 **Opens in Tidal** — Host plays the playlist in the Tidal app

## How It Works

1. **Host** logs in to Tidal and creates or selects a playlist
2. **Host** shares the 6-letter code with others
3. **Everyone** joins and searches for songs to add
4. **Songs** are added to both the local view and the actual Tidal playlist
5. **Host** opens the playlist in Tidal and hits play

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.io
- **Database**: Redis/Valkey for session & token persistence
- **Styling**: Custom CSS with ocean-themed design
- **Real-time**: WebSocket for instant updates

## Getting Started

### Prerequisites

- Node.js 18+
- A Tidal account (Premium required for full functionality)
- Redis/Valkey instance (for session persistence)

### Tidal API Setup

1. Register your app at the [Tidal Developer Portal](https://developer.tidal.com/)
2. Note your **Client ID** and **Client Secret**
3. Set **Redirect URI** to your backend's callback URL:
   - Local development: `http://localhost:3001/api/auth/callback`
   - Production: `https://your-backend-domain.com/api/auth/callback`
4. Enable these **Scopes**:
   - `user.read` — Get user info
   - `search.read` — Search the catalog
   - `playlists.read` — List user's playlists
   - `playlists.write` — Create and modify playlists

### Environment Variables

Create `server/.env`:

```env
# Tidal OAuth credentials (from developer.tidal.com)
TIDAL_CLIENT_ID="your_client_id"
TIDAL_CLIENT_SECRET="your_client_secret"

# Redis/Valkey connection URL (required)
REDIS_URL="redis://localhost:6379"
# For TLS: REDIS_URL="rediss://user:password@host:port"

# For local development:
REDIRECT_URI="http://localhost:3001/api/auth/callback"
CLIENT_URL="http://localhost:5173"

# For production, use your actual domains instead:
# REDIRECT_URI="https://your-backend.onrender.com/api/auth/callback"
# CLIENT_URL="https://your-frontend.vercel.app"
```

### Installation

```bash
# Clone the repo
git clone https://github.com/rgarth/TidePool.git
cd TidePool

# Install server dependencies
cd server
npm install

# Install web dependencies
cd ../web
npm install
```

### Local Development

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd web
npm run dev
```

Open http://localhost:5173 in your browser.

## Deployment

### Backend (Render)

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repo
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add environment variables:
   - `TIDAL_CLIENT_ID`
   - `TIDAL_CLIENT_SECRET`
   - `REDIS_URL` (your Redis/Valkey connection string)
   - `FRONTEND_URL` (your Vercel URL, e.g., `https://tidepool.vercel.app`)
   - `NODE_ENV=production`
5. Update Tidal Developer Portal with your Render callback URL:
   - `https://your-app.onrender.com/api/auth/callback`

### Frontend (Vercel)

1. Import your repo on [Vercel](https://vercel.com)
2. Set **Root Directory** to `web`
3. Add environment variable:
   - `VITE_API_URL` = your Render backend URL (e.g., `https://your-app.onrender.com`)
4. Deploy!

## Project Structure

```
TidePool/
├── server/              # Express + Socket.io backend
│   └── src/
│       ├── routes/      # API routes (auth, sessions, tidal)
│       ├── services/    # Business logic (tidal, tokens, valkey)
│       ├── socket/      # WebSocket handlers
│       └── utils/       # Helpers (sanitize)
├── web/                 # React frontend
│   └── src/
│       ├── pages/       # HomePage, SessionPage, JoinPage, etc.
│       ├── components/  # Reusable UI components
│       ├── hooks/       # useSocket, useAuth, useSearch, etc.
│       └── styles/      # CSS
└── README.md
```

## License

MIT

---

*Powered by Tidal* 🌊
