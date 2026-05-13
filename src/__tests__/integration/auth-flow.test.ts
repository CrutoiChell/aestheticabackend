import request from 'supertest';
import express, { Application } from 'express';
import authRoutes from '../../routes/auth';
import { jsonStorage } from '../../storage/jsonStorage';
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

describe('Authentication Flow Integration', () => {
  let app: Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  it('should complete full registration -> login -> get profile flow', async () => {
    // Step 1: Register a new user
    (jsonStorage.read as jest.Mock).mockResolvedValue([]);
    (jsonStorage.update as jest.Mock).mockResolvedValue(undefined);

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'securepass123',
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.success).toBe(true);
    expect(registerResponse.body.data.token).toBeDefined();
    
    const userId = registerResponse.body.data.user.id;

    // Step 2: Login with the same credentials
    const mockUser = {
      id: userId,
      name: 'Jane Smith',
      email: 'jane@example.com',
      passwordHash: registerResponse.body.data.user.passwordHash || 'mockHash',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);
    
    // Mock bcrypt compare
    const bcrypt = require('bcrypt');
    bcrypt.compare = jest.fn().mockResolvedValue(true);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jane@example.com',
        password: 'securepass123',
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data.token).toBeDefined();
    
    const loginToken = loginResponse.body.data.token;

    // Step 3: Get profile using the token
    const jwt = require('jsonwebtoken');
    jwt.verify = jest.fn().mockReturnValue({
      userId: userId,
      email: 'jane@example.com',
      role: 'user',
      iat: Date.now(),
      exp: Date.now() + 3600,
    });

    const profileResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginToken}`);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.success).toBe(true);
    expect(profileResponse.body.data.user.email).toBe('jane@example.com');
    expect(profileResponse.body.data.user.name).toBe('Jane Smith');
    expect(profileResponse.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('should reject access to protected route without token', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject duplicate registration', async () => {
    const existingUser = {
      id: '123',
      name: 'Existing User',
      email: 'existing@example.com',
      passwordHash: 'hashedpassword',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    (jsonStorage.read as jest.Mock).mockResolvedValue([existingUser]);

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'New User',
        email: 'existing@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain('already registered');
  });
});
