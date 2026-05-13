import request from 'supertest';
import express, { Application } from 'express';
import artworkRoutes from '../../routes/artworks';
import authRoutes from '../../routes/auth';
import { jsonStorage } from '../../storage/jsonStorage';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';

// Mock the jsonStorage and middleware
jest.mock('../../storage/jsonStorage');
jest.mock('../../middleware/auth');

// Create test app
const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/artworks', artworkRoutes);
  app.use(errorHandler);
  return app;
};

describe('Artwork Flow Integration', () => {
  let app: Application;
  let adminToken: string;
  let artworkId: string;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();

    // Mock authenticate middleware to pass through
    (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
      req.user = { userId: 'admin-1', email: 'admin@test.com', role: 'admin' };
      next();
    });

    // Mock requireAdmin middleware to pass through
    (requireAdmin as jest.Mock).mockImplementation((_req, _res, next) => {
      next();
    });

    // Generate a mock token
    adminToken = 'mock-admin-token';
  });

  it('should complete full artwork CRUD flow', async () => {
    const mockArtworks: any[] = [];

    // 1. Create an artwork
    (jsonStorage.update as jest.Mock).mockImplementation(
      async (_filename, updateFn) => {
        return updateFn(mockArtworks);
      }
    );

    const createResponse = await request(app)
      .post('/api/artworks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Artwork',
        artist: 'Test Artist',
        year: 2024,
        description: 'A test artwork',
        imageUrl: 'https://example.com/test.jpg',
        dimensions: { width: 100, height: 80, unit: 'cm' },
        medium: 'Oil on canvas',
        exhibitionId: 'test-exhibition-1',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.artwork).toMatchObject({
      title: 'Test Artwork',
      artist: 'Test Artist',
      year: 2024,
    });

    artworkId = createResponse.body.data.artwork.id;

    // 2. Get all artworks
    (jsonStorage.read as jest.Mock).mockResolvedValue(mockArtworks);

    const getAllResponse = await request(app).get('/api/artworks');

    expect(getAllResponse.status).toBe(200);
    expect(getAllResponse.body.success).toBe(true);
    expect(getAllResponse.body.data.artworks).toBeInstanceOf(Array);
    expect(
      getAllResponse.body.data.artworks.some((a: any) => a.id === artworkId)
    ).toBe(true);

    // 3. Get artwork by ID
    const getByIdResponse = await request(app).get(`/api/artworks/${artworkId}`);

    expect(getByIdResponse.status).toBe(200);
    expect(getByIdResponse.body.success).toBe(true);
    expect(getByIdResponse.body.data.artwork.id).toBe(artworkId);

    // 4. Filter artworks by exhibitionId
    const filterResponse = await request(app).get(
      '/api/artworks?exhibitionId=test-exhibition-1'
    );

    expect(filterResponse.status).toBe(200);
    expect(filterResponse.body.success).toBe(true);
    expect(filterResponse.body.data.artworks).toBeInstanceOf(Array);
    expect(
      filterResponse.body.data.artworks.every(
        (a: any) => a.exhibitionId === 'test-exhibition-1'
      )
    ).toBe(true);

    // 5. Update artwork
    const updateResponse = await request(app)
      .put(`/api/artworks/${artworkId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Updated Test Artwork',
        year: 2025,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.artwork.title).toBe('Updated Test Artwork');
    expect(updateResponse.body.data.artwork.year).toBe(2025);
    expect(updateResponse.body.data.artwork.artist).toBe('Test Artist'); // unchanged

    // 6. Delete artwork
    const deleteResponse = await request(app)
      .delete(`/api/artworks/${artworkId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);

    // 7. Verify artwork is deleted
    (jsonStorage.read as jest.Mock).mockResolvedValue(
      mockArtworks.filter((a) => a.id !== artworkId)
    );

    const getDeletedResponse = await request(app).get(
      `/api/artworks/${artworkId}`
    );

    expect(getDeletedResponse.status).toBe(404);
  });

  it('should reject artwork creation without admin token', async () => {
    // Mock authenticate to reject
    (authenticate as jest.Mock).mockImplementation((_req, res, _next) => {
      res.status(401).json({
        success: false,
        error: {
          message: 'No authorization token provided',
          code: 'UNAUTHORIZED',
        },
      });
    });

    const response = await request(app)
      .post('/api/artworks')
      .send({
        title: 'Test Artwork',
        artist: 'Test Artist',
        year: 2024,
        description: 'A test artwork',
        imageUrl: 'https://example.com/test.jpg',
        exhibitionId: 'test-exhibition-1',
      });

    expect(response.status).toBe(401);
  });

  it('should validate required fields', async () => {
    // Reset authenticate mock to pass through
    (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
      req.user = { userId: 'admin-1', email: 'admin@test.com', role: 'admin' };
      next();
    });

    const response = await request(app)
      .post('/api/artworks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Artwork',
        // missing required fields
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
