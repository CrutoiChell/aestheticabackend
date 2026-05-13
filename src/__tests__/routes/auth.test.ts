import request from 'supertest';
import express, { Application } from 'express';
import authRoutes from '../../routes/auth';
import { jsonStorage } from '../../storage/jsonStorage';
import { User } from '../../types';
import { errorHandler } from '../../middleware/errorHandler';

// Create test app
const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
};

// Mock jsonStorage
jest.mock('../../storage/jsonStorage');

describe('Authentication Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      // Mock empty users array
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);
      (jsonStorage.update as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('john@example.com');
      expect(response.body.data.user.name).toBe('John Doe');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 400 if email already exists', async () => {
      // Mock existing user
      const existingUser: User = {
        id: '123',
        name: 'Existing User',
        email: 'john@example.com',
        passwordHash: 'hashedpassword',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      (jsonStorage.read as jest.Mock).mockResolvedValue([existingUser]);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already registered');
    });

    it('should return 400 if password is too short', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('at least 8 characters');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'john@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Mock user with hashed password
      const hashedPassword = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890'; // Mock bcrypt hash
      const mockUser: User = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: hashedPassword,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);

      // Mock bcrypt compare
      const bcrypt = require('bcrypt');
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('john@example.com');
    });

    it('should return 401 with invalid email', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('should return 401 with invalid password', async () => {
      const mockUser: User = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashedpassword',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);

      // Mock bcrypt compare to return false
      const bcrypt = require('bcrypt');
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user data with valid token', async () => {
      const mockUser: User = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashedpassword',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);

      // Mock JWT verification
      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockReturnValue({
        userId: '123',
        email: 'john@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600,
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer validtoken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('john@example.com');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('No authorization token');
    });

    it('should return 401 with invalid token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token123');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid authorization format');
    });

    it('should return 401 with expired token', async () => {
      // Mock JWT verification to throw expired error
      const jwt = require('jsonwebtoken');
      const TokenExpiredError = jwt.TokenExpiredError;
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new TokenExpiredError('jwt expired', new Date());
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer expiredtoken');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Token expired');
    });

    it('should return 404 if user not found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);

      // Mock JWT verification
      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockReturnValue({
        userId: '999',
        email: 'nonexistent@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600,
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer validtoken123');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('User not found');
    });
  });
});
