import request from 'supertest';
import express, { Application } from 'express';
import artworkRoutes from '../../routes/artworks';
import * as artworkService from '../../services/artworkService';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { Artwork } from '../../types';
import { ApiError, errorHandler } from '../../middleware/errorHandler';

// Mock the services and middleware
jest.mock('../../services/artworkService');
jest.mock('../../middleware/auth');

describe('Artwork Routes', () => {
  let app: Application;

  const mockArtwork: Artwork = {
    id: '1',
    title: 'Starry Night',
    artist: 'Vincent van Gogh',
    year: 1889,
    description: 'A famous painting',
    imageUrl: 'https://example.com/starry-night.jpg',
    exhibitionId: 'exhibition-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/artworks', artworkRoutes);
    app.use(errorHandler);

    jest.clearAllMocks();

    // Mock authenticate middleware to pass through
    (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
      req.user = { userId: '1', email: 'admin@test.com', role: 'admin' };
      next();
    });

    // Mock requireAdmin middleware to pass through
    (requireAdmin as jest.Mock).mockImplementation((_req, _res, next) => {
      next();
    });
  });

  describe('GET /api/artworks', () => {
    it('should return all artworks', async () => {
      const mockArtworks = [mockArtwork];
      (artworkService.getAllArtworks as jest.Mock).mockResolvedValue(
        mockArtworks
      );

      const response = await request(app).get('/api/artworks');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { artworks: mockArtworks },
      });
    });

    it('should filter artworks by exhibitionId', async () => {
      const mockArtworks = [mockArtwork];
      (artworkService.getAllArtworks as jest.Mock).mockResolvedValue(
        mockArtworks
      );

      const response = await request(app).get(
        '/api/artworks?exhibitionId=exhibition-1'
      );

      expect(response.status).toBe(200);
      expect(artworkService.getAllArtworks).toHaveBeenCalledWith({
        exhibitionId: 'exhibition-1',
      });
    });

    it('should return 500 on service error', async () => {
      (artworkService.getAllArtworks as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/artworks');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/artworks/:id', () => {
    it('should return artwork by id', async () => {
      (artworkService.getArtworkById as jest.Mock).mockResolvedValue(
        mockArtwork
      );

      const response = await request(app).get('/api/artworks/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { artwork: mockArtwork },
      });
    });

    it('should return 404 when artwork not found', async () => {
      const error = new ApiError(404, 'Artwork not found', 'NOT_FOUND');
      (artworkService.getArtworkById as jest.Mock).mockRejectedValue(error);

      const response = await request(app).get('/api/artworks/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 on service error', async () => {
      (artworkService.getArtworkById as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/artworks/1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/artworks', () => {
    const newArtworkData = {
      title: 'Mona Lisa',
      artist: 'Leonardo da Vinci',
      year: 1503,
      description: 'A portrait painting',
      imageUrl: 'https://example.com/mona-lisa.jpg',
      exhibitionId: 'exhibition-1',
    };

    it('should create a new artwork', async () => {
      const createdArtwork = { ...mockArtwork, ...newArtworkData };
      (artworkService.createArtwork as jest.Mock).mockResolvedValue(
        createdArtwork
      );

      const response = await request(app)
        .post('/api/artworks')
        .send(newArtworkData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: { artwork: createdArtwork },
      });
      expect(authenticate).toHaveBeenCalled();
      expect(requireAdmin).toHaveBeenCalled();
    });

    it('should return 400 on validation error', async () => {
      const error = new ApiError(400, 'Validation failed', 'VALIDATION_ERROR');
      (artworkService.createArtwork as jest.Mock).mockRejectedValue(error);

      const response = await request(app)
        .post('/api/artworks')
        .send(newArtworkData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 on service error', async () => {
      (artworkService.createArtwork as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/artworks')
        .send(newArtworkData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/artworks/:id', () => {
    const updateData = {
      title: 'Updated Title',
      year: 1890,
    };

    it('should update an artwork', async () => {
      const updatedArtwork = { ...mockArtwork, ...updateData };
      (artworkService.updateArtwork as jest.Mock).mockResolvedValue(
        updatedArtwork
      );

      const response = await request(app)
        .put('/api/artworks/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { artwork: updatedArtwork },
      });
      expect(authenticate).toHaveBeenCalled();
      expect(requireAdmin).toHaveBeenCalled();
    });

    it('should return 404 when artwork not found', async () => {
      const error = new ApiError(404, 'Artwork not found', 'NOT_FOUND');
      (artworkService.updateArtwork as jest.Mock).mockRejectedValue(error);

      const response = await request(app)
        .put('/api/artworks/non-existent')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 on service error', async () => {
      (artworkService.updateArtwork as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .put('/api/artworks/1')
        .send(updateData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/artworks/:id', () => {
    it('should delete an artwork', async () => {
      (artworkService.deleteArtwork as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).delete('/api/artworks/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { message: 'Artwork deleted successfully' },
      });
      expect(authenticate).toHaveBeenCalled();
      expect(requireAdmin).toHaveBeenCalled();
    });

    it('should return 404 when artwork not found', async () => {
      const error = new ApiError(404, 'Artwork not found', 'NOT_FOUND');
      (artworkService.deleteArtwork as jest.Mock).mockRejectedValue(error);

      const response = await request(app).delete('/api/artworks/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 on service error', async () => {
      (artworkService.deleteArtwork as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).delete('/api/artworks/1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
