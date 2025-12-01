# 🌊 TidePool

**Road trips, together. Everyone picks the music.**

TidePool is a collaborative music queue app for road trips and parties. The driver (host) controls playback while passengers can search and add songs to the shared queue in real-time.

## Features

- 🎵 **Shared Queue** — Everyone sees the same queue, updated in real-time
- 🔍 **Search** — Find songs from the Tidal catalog
- 📋 **My Playlists** — Load your pre-made playlists to start the trip
- ▶️ **Play Next / Add to Queue** — Passengers can insert songs or add to the end
- 📱 **Easy Sharing** — QR code or native share to invite passengers
- 🚗 **Host Controls** — Only the driver controls playback

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.io
- **Styling**: Custom CSS with ocean-themed design
- **Real-time**: WebSocket for instant queue sync

## Getting Started

### Prerequisites

- Node.js 18+
- A Tidal account (for future API integration)

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

### Development

Run both servers in separate terminals:

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd web
npm run dev
```

Open http://localhost:5173 in your browser.

### How to Use

1. **Driver**: Click "Start a Session" → Enter your name → Get a 6-letter code
2. **Passengers**: Click "Join Session" → Enter the code (or scan QR)
3. **Everyone**: Search for songs and add them to the queue
4. **Driver**: Controls play/pause/skip from their device

## Project Structure

```
TidePool/
├── server/           # Backend (Express + Socket.io)
│   └── src/
│       └── index.ts  # Main server file
├── web/              # Frontend (React + Vite)
│   └── src/
│       ├── pages/    # Route components
│       ├── hooks/    # Custom hooks (useSocket)
│       ├── styles/   # Global CSS
│       └── types.ts  # TypeScript types
└── README.md
```

## Roadmap

- [ ] Tidal OAuth integration
- [ ] Real Tidal API search
- [ ] Actual audio playback via Tidal SDK
- [ ] iOS app (React Native)
- [ ] CarPlay support

## License

MIT

---

*Powered by Tidal* 🌊
