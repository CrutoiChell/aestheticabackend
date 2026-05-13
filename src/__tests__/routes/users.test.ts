import request from 'supertest';
import express, { Application } from 'express';
import userRoutes from '../../routes/users';
import * as userService from '../../services/userService';
import { authenticate } from '../../middleware/auth';
import { ApiError, errorHandler } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../services/userService');
jest.mock('../../middleware/auth');

describe('User Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    app.use(errorHandler);
    jest.clearAllMocks();
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile for authenticated user', async () => {
      const mockUser = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user' as const,
        preferences: {
          favoriteArtists: ['Artist 1'],
          favoriteStyles: ['Modern'],
          notificationEnabled: true,
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock authenticate middleware to set req.user
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: '1',
          email: 'john@example.com',
          role: 'user',
        };
        next();
      });

      (userService.getUserProfile as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/profile')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { user: mockUser },
      });
      expect(userService.getUserProfile).toHaveBeenCalledWith('1');
    });

    it('should return 401 if user is not authenticated', async () => {
      // Mock authenticate middleware to not set req.user
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = undefined;
        next();
      });

      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
      });
    });

    it('should return 404 if user not found', async () => {
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: 'nonexistent',
          email: 'test@example.com',
          role: 'user',
        };
        next();
      });

      (userService.getUserProfile as jest.Mock).mockRejectedValue(
        new ApiError(404, 'User not found', 'NOT_FOUND')
      );

      const response = await request(app)
        .get('/api/users/profile')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'User not found',
          code: 'NOT_FOUND',
        },
      });
    });

    it('should return 500 on internal error', async () => {
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: '1',
          email: 'john@example.com',
          role: 'user',
        };
        next();
      });

      (userService.getUserProfile as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/users/profile')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      });
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile', async () => {
      const updateData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
      };

      const updatedUser = {
        id: '1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'user' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: '1',
          email: 'john@example.com',
          role: 'user',
        };
        next();
      });

      (userService.updateUserProfile as jest.Mock).mockResolvedValue(
        updatedUser
      );

      const response = await request(app)
        .put('/api/users/profile')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { user: updatedUser },
      });
      expect(userService.updateUserProfile).toHaveBeenCalledWith(
        '1',
        updateData
      );
    });

    it('should update only preferences', async () => {
      const updateData = {
        preferences: {
          favoriteArtists: ['Artist 2'],
          favoriteStyles: ['Contemporary'],
          notificationEnabled: false,
        },
      };

      const updatedUser = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user' as const,
        preferences: updateData.preferences,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: '1',
          email: 'john@example.com',
          role: 'user',
        };
        next();
      });

      (userService.updateUserProfile as jest.Mock).mockResolvedValue(
        updatedUser
      );

      const response = await request(app)
        .put('/api/users/profile')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { user: updatedUser },
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = undefined;
        next();
      });

      const response = await request(app)
        .put('/api/users/profile')
        .send({ name: 'Test' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
      });
    });

    it('should return 400 for validation errors', async () => {
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: '1',
          email: 'john@example.com',
          role: 'user',
        };
        next();
      });

      (userService.updateUserProfile as jest.Mock).mockRejectedValue(
        new ApiError(400, 'Invalid email format', 'VALIDATION_ERROR', {
          field: 'email',
        })
      );

      const response = await request(app)
        .put('/api/users/profile')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Invalid email format',
          code: 'VALIDATION_ERROR',
          details: { field: 'email' },
        },
      });
    });

    it('should return 400 if email is already taken', async () => {
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: '1',
          email: 'john@example.com',
          role: 'user',
        };
        next();
      });

      (userService.updateUserProfile as jest.Mock).mockRejectedValue(
        new ApiError(400, 'Email already in use', 'VALIDATION_ERROR', {
          field: 'email',
        })
      );

      const response = await request(app)
        .put('/api/users/profile')
        .send({ email: 'taken@example.com' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Email already in use',
          code: 'VALIDATION_ERROR',
          details: { field: 'email' },
        },
      });
    });

    it('should return 404 if user not found', async () => {
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: 'nonexistent',
          email: 'test@example.com',
          role: 'user',
        };
        next();
      });

      (userService.updateUserProfile as jest.Mock).mockRejectedValue(
        new ApiError(404, 'User not found', 'NOT_FOUND')
      );

      const response = await request(app)
        .put('/api/users/profile')
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'User not found',
          code: 'NOT_FOUND',
        },
      });
    });

    it('should return 500 on internal error', async () => {
      (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
        req.user = {
          userId: '1',
          email: 'john@example.com',
          role: 'user',
        };
        next();
      });

      (userService.updateUserProfile as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .put('/api/users/profile')
        .send({ name: 'Test' })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      });
    });
  });
});
