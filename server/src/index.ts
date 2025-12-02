// TidePool Server - Entry Point
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Fix for TLS certificate verification issues in development
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Import configuration
import { CLIENT_URL } from './services/tokens';

// Import routes
import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import tidalRoutes, { setSocketIO } from './routes/tidal';

// Import socket handlers
import { setupSocketHandlers } from './socket/handlers';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Pass Socket.io to tidal routes
setSocketIO(io);

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  const { sessions } = require('./routes/sessions');
  res.json({ status: 'ok', sessions: sessions.size });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/tidal', tidalRoutes);

// Setup WebSocket handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
🌊 TidePool Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server running on http://localhost:${PORT}
WebSocket ready for connections
  `);
});
