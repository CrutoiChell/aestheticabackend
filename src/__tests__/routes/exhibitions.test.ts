import request from 'supertest';
import express, { Application } from 'express';
import exhibitionRoutes from '../../routes/exhibitions';
import { jsonStorage } from '../../storage/jsonStorage';
import { Exhibition } from '../../types';
import { errorHandler } from '../../middleware/errorHandler';

// Create test app
const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/api/exhibitions', exhibitionRoutes);
  app.use(errorHandler);
  return app;
};

// Mock jsonStorage
jest.mock('../../storage/jsonStorage');

// Mock JWT for authentication
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  sign: jest.fn(),
}));

describe('Exhibition Routes', () => {
  let app: Application;
  const jwt = require('jsonwebtoken');

  const mockExhibition: Exhibition = {
    id: 'exhibition-1',
    title: 'Modern Art Exhibition',
    description: 'A collection of modern art pieces',
    gallery: 'Metropolitan Gallery',
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    imageUrl: 'https://example.com/image.jpg',
    location: 'New York',
    artworkIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockAdminToken = {
    userId: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 3600,
  };

  const mockUserToken = {
    userId: 'user-1',
    email: 'user@example.com',
    role: 'user',
    iat: Date.now(),
    exp: Date.now() + 3600,
  };

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('GET /api/exhibitions', () => {
    it('should return all exhibitions', async () => {
      const exhibitions = [mockExhibition];
      (jsonStorage.read as jest.Mock).mockResolvedValue(exhibitions);

      const response = await request(app).get('/api/exhibitions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibitions).toHaveLength(1);
      expect(response.body.data.exhibitions[0].title).toBe('Modern Art Exhibition');
    });

    it('should filter exhibitions by search query', async () => {
      const exhibitions = [
        mockExhibition,
        {
          ...mockExhibition,
          id: 'exhibition-2',
          title: 'Classical Art',
          description: 'A collection of classical art pieces',
          gallery: 'Classical Gallery',
        },
      ];
      (jsonStorage.read as jest.Mock).mockResolvedValue(exhibitions);

      const response = await request(app)
        .get('/api/exhibitions')
        .query({ search: 'modern' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibitions).toHaveLength(1);
      expect(response.body.data.exhibitions[0].title).toBe('Modern Art Exhibition');
    });

    it('should filter exhibitions by gallery', async () => {
      const exhibitions = [
        mockExhibition,
        {
          ...mockExhibition,
          id: 'exhibition-2',
          gallery: 'Another Gallery',
        },
      ];
      (jsonStorage.read as jest.Mock).mockResolvedValue(exhibitions);

      const response = await request(app)
        .get('/api/exhibitions')
        .query({ gallery: 'Metropolitan Gallery' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibitions).toHaveLength(1);
      expect(response.body.data.exhibitions[0].gallery).toBe('Metropolitan Gallery');
    });

    it('should filter exhibitions by date range', async () => {
      const exhibitions = [
        mockExhibition,
        {
          ...mockExhibition,
          id: 'exhibition-2',
          startDate: '2024-06-01',
          endDate: '2024-08-31',
        },
      ];
      (jsonStorage.read as jest.Mock).mockResolvedValue(exhibitions);

      const response = await request(app)
        .get('/api/exhibitions')
        .query({ startDate: '2024-01-01', endDate: '2024-04-30' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibitions).toHaveLength(1);
    });

    it('should return empty array when no exhibitions match', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockExhibition]);

      const response = await request(app)
        .get('/api/exhibitions')
        .query({ search: 'nonexistent' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibitions).toHaveLength(0);
    });

    it('should return 500 on storage error', async () => {
      (jsonStorage.read as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const response = await request(app).get('/api/exhibitions');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/exhibitions/:id', () => {
    it('should return exhibition by ID', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockExhibition]);

      const response = await request(app).get('/api/exhibitions/exhibition-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibition.id).toBe('exhibition-1');
      expect(response.body.data.exhibition.title).toBe('Modern Art Exhibition');
    });

    it('should return 404 if exhibition not found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/exhibitions/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Exhibition not found');
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 500 on storage error', async () => {
      (jsonStorage.read as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const response = await request(app).get('/api/exhibitions/exhibition-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/exhibitions', () => {
    const newExhibitionData = {
      title: 'New Exhibition',
      description: 'A new exhibition',
      gallery: 'Test Gallery',
      startDate: '2024-05-01',
      endDate: '2024-07-31',
      imageUrl: 'https://example.com/new.jpg',
      location: 'Boston',
    };

    it('should create exhibition with admin token', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);
      (jsonStorage.update as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/exhibitions')
        .set('Authorization', 'Bearer admin-token')
        .send(newExhibitionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibition).toHaveProperty('id');
      expect(response.body.data.exhibition.title).toBe('New Exhibition');
      expect(response.body.data.exhibition).toHaveProperty('createdAt');
      expect(response.body.data.exhibition).toHaveProperty('updatedAt');
    });

    it('should return 401 without authorization token', async () => {
      const response = await request(app)
        .post('/api/exhibitions')
        .send(newExhibitionData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('No authorization token');
    });

    it('should return 403 with non-admin token', async () => {
      jwt.verify.mockReturnValue(mockUserToken);

      const response = await request(app)
        .post('/api/exhibitions')
        .set('Authorization', 'Bearer user-token')
        .send(newExhibitionData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Admin access required');
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 400 with missing required fields', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);

      const response = await request(app)
        .post('/api/exhibitions')
        .set('Authorization', 'Bearer admin-token')
        .send({ title: 'Incomplete' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 with invalid date format', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);

      const response = await request(app)
        .post('/api/exhibitions')
        .set('Authorization', 'Bearer admin-token')
        .send({
          ...newExhibitionData,
          startDate: 'invalid-date',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when end date is before start date', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);

      const response = await request(app)
        .post('/api/exhibitions')
        .set('Authorization', 'Bearer admin-token')
        .send({
          ...newExhibitionData,
          startDate: '2024-07-31',
          endDate: '2024-05-01',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('End date must be after start date');
    });
  });

  describe('PUT /api/exhibitions/:id', () => {
    const updateData = {
      title: 'Updated Exhibition',
      description: 'Updated description',
    };

    it('should update exhibition with admin token', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockExhibition]);
      (jsonStorage.update as jest.Mock).mockImplementation((_file, callback) => {
        const exhibitions = [mockExhibition];
        callback(exhibitions);
        return Promise.resolve();
      });

      const response = await request(app)
        .put('/api/exhibitions/exhibition-1')
        .set('Authorization', 'Bearer admin-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibition.title).toBe('Updated Exhibition');
      expect(response.body.data.exhibition.description).toBe('Updated description');
    });

    it('should return 401 without authorization token', async () => {
      const response = await request(app)
        .put('/api/exhibitions/exhibition-1')
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 with non-admin token', async () => {
      jwt.verify.mockReturnValue(mockUserToken);

      const response = await request(app)
        .put('/api/exhibitions/exhibition-1')
        .set('Authorization', 'Bearer user-token')
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 if exhibition not found', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);
      (jsonStorage.update as jest.Mock).mockImplementation((_file, callback) => {
        callback([]);
        return Promise.resolve();
      });

      const response = await request(app)
        .put('/api/exhibitions/nonexistent')
        .set('Authorization', 'Bearer admin-token')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Exhibition not found');
    });

    it('should return 400 with invalid date format', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);

      const response = await request(app)
        .put('/api/exhibitions/exhibition-1')
        .set('Authorization', 'Bearer admin-token')
        .send({ startDate: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/exhibitions/:id', () => {
    it('should delete exhibition with admin token', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);
      (jsonStorage.update as jest.Mock).mockImplementation((_file, callback) => {
        const exhibitions = [mockExhibition];
        callback(exhibitions);
        return Promise.resolve();
      });

      const response = await request(app)
        .delete('/api/exhibitions/exhibition-1')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Exhibition deleted successfully');
    });

    it('should return 401 without authorization token', async () => {
      const response = await request(app).delete('/api/exhibitions/exhibition-1');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 with non-admin token', async () => {
      jwt.verify.mockReturnValue(mockUserToken);

      const response = await request(app)
        .delete('/api/exhibitions/exhibition-1')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 if exhibition not found', async () => {
      jwt.verify.mockReturnValue(mockAdminToken);
      (jsonStorage.update as jest.Mock).mockImplementation((_file, callback) => {
        callback([]);
        return Promise.resolve();
      });

      const response = await request(app)
        .delete('/api/exhibitions/nonexistent')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Exhibition not found');
    });
  });
});
