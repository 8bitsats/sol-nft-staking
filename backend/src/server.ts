// server.ts - Main Express Server Setup
import express from 'express';
import { createServer } from 'http';

import stakingRoutes from './api/routes/staking';

const app = express();
const server = createServer(app);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate IP detection
app.set('trust proxy', 1);

// API Routes
app.use('/api/staking', stakingRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Terminal Staking API Server running on port ${PORT}`);
  console.log(`📊 WebSocket server running on port ${process.env.WS_PORT || 8080}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🗄️  Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;
