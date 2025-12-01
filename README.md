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
- **Music**: Tidal API for search, playlists, and playback
- **Styling**: Custom CSS with ocean-themed design
- **Real-time**: WebSocket for instant queue sync

---

## 🔧 Setup Guide

### Prerequisites

- Node.js 18+
- A Tidal Developer account
- A Tidal subscription (for playback)

### Step 1: Create a Tidal Application

1. Go to [Tidal Developer Portal](https://developer.tidal.com/)
2. Sign in with your Tidal account
3. Click **"Create App"** or **"My Apps"** → **"New Application"**
4. Fill in the application details:
   - **App Name**: TidePool (or your preferred name)
   - **Description**: Collaborative music queue for road trips
   - **Website**: http://localhost:5173 (for development)

### Step 2: Configure Redirect URIs

In your Tidal app settings, add the following redirect URI:

```
http://localhost:3001/api/auth/callback
```

For production, add your production callback URL as well.

### Step 3: Configure OAuth Scopes

In your Tidal app settings, enable the following scopes:

| Scope | Description |
|-------|-------------|
| `user.read` | Read access to user's account information |
| `collection.read` | Read access to user's "My Collection" |
| `search.read` | Required for personalized search results |
| `playlists.read` | Required to list playlists created by a user |
| `playlists.write` | Write access to user's playlists (for saving) |
| `entitlements.read` | Read access to what functionality a user can access |
| `playback` | **Required for streaming audio** |

> ⚠️ **Note**: The `playback` scope may require approval from Tidal for production apps.

### Step 4: Get Your Client Credentials

After creating your app, copy:
- **Client ID** 
- **Client Secret**

### Step 5: Create Environment File

Create a `.env` file in the `server/` directory:

```bash
cd server
touch .env
```

Add your credentials:

```env
# Tidal API Credentials
TIDAL_CLIENT_ID=your_client_id_here
TIDAL_CLIENT_SECRET=your_client_secret_here

# OAuth Redirect (must match Tidal app settings)
REDIRECT_URI=http://localhost:3001/api/auth/callback

# Frontend URL (for redirects after auth)
CLIENT_URL=http://localhost:5173
```

### Step 6: Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install web dependencies
cd ../web
npm install
```

### Step 7: Start Development Servers

Run both servers in separate terminals:

```bash
# Terminal 1 - Backend (port 3001)
cd server
npm run dev

# Terminal 2 - Frontend (port 5173)
cd web
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 🚀 How to Use

### As the Driver (Host)

1. Click **"Start a Session"**
2. Enter your display name
3. Click **"Login with Tidal"** to connect your account
4. Share the session code or QR code with passengers
5. Control playback with the play/pause/skip buttons

### As a Passenger

1. Click **"Join Session"** 
2. Enter the 6-letter code (or scan the QR code)
3. Enter your display name
4. Search for songs and add them to the queue!

---

## 📁 Project Structure

```
TidePool/
├── server/                 # Backend (Express + Socket.io)
│   ├── src/
│   │   └── index.ts        # Main server file
│   ├── .env                # Environment variables (create this)
│   └── package.json
├── web/                    # Frontend (React + Vite)
│   └── src/
│       ├── pages/          # Route components
│       ├── hooks/          # Custom hooks (useSocket, useTidalPlayer)
│       ├── styles/         # Global CSS
│       └── types.ts        # TypeScript types
└── README.md
```

---

## 🔒 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TIDAL_CLIENT_ID` | Yes | Your Tidal app's Client ID |
| `TIDAL_CLIENT_SECRET` | Yes | Your Tidal app's Client Secret |
| `REDIRECT_URI` | No | OAuth callback URL (default: `http://localhost:3001/api/auth/callback`) |
| `CLIENT_URL` | No | Frontend URL for redirects (default: `http://localhost:5173`) |

---

## 🎨 Customization

### Theme Colors

The app uses an aqua/cyan ocean theme. Colors can be customized in:
```
web/src/styles/global.css
```

Key CSS variables:
```css
--accent-cyan: #22d3ee;    /* Primary accent */
--accent-green: #67e8f9;   /* Secondary accent */
--bg-primary: #030d14;     /* Background */
```

---

## 🐛 Troubleshooting

### "Token is missing required scope"
Make sure you've enabled all required scopes in your Tidal app settings, especially `playback`.

### "Failed to get playback info: 403"
Re-login with Tidal to refresh your access token with the new scopes.

### Search returns no results
1. Check that you're logged in (click your profile or check `/api/auth/status`)
2. Verify your Tidal credentials in `.env`
3. Check the server console for API errors

### Album art not showing
The Tidal API requires the `albums.coverArt` include parameter. This is handled automatically.

---

## 📋 Roadmap

- [x] Tidal OAuth integration
- [x] Real Tidal API search
- [x] Album artwork display
- [x] Playlist browsing
- [ ] Actual audio playback via Tidal SDK
- [ ] iOS app (React Native)
- [ ] CarPlay support
- [ ] Offline queue persistence

---

## 📄 License

MIT

---

*Powered by Tidal* 🌊
