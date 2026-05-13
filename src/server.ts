// TODO: Consider adding rate limiting via express-rate-limit to protect auth
// and write endpoints from abuse (e.g. login brute force, comment spam).
import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import exhibitionRoutes from './routes/exhibitions';
import artworkRoutes from './routes/artworks';
import userRoutes from './routes/users';
import statsRoutes from './routes/stats';
import uploadRoutes from './routes/upload';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Environment-aware CORS: read comma-separated origins from CORS_ORIGINS,
// falling back to localhost:3000 for local development.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. same-origin, curl, mobile apps)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('CORS not allowed'));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (skipped in test env to keep test output clean)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/exhibitions', exhibitionRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/upload', uploadRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize and start server
const startServer = async () => {
  try {
    logger.info('Supabase client initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
