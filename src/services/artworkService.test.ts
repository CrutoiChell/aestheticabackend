import * as artworkService from './artworkService';
import { jsonStorage } from '../storage/jsonStorage';
import { Artwork } from '../types';
import { ApiError } from '../middleware/errorHandler';

// Mock the jsonStorage module
jest.mock('../storage/jsonStorage');

describe('Artwork Service', () => {
  const mockArtworks: Artwork[] = [
    {
      id: '1',
      title: 'Starry Night',
      artist: 'Vincent van Gogh',
      year: 1889,
      description: 'A famous painting',
      imageUrl: 'https://example.com/starry-night.jpg',
      exhibitionId: 'exhibition-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      title: 'The Scream',
      artist: 'Edvard Munch',
      year: 1893,
      description: 'An expressionist painting',
      imageUrl: 'https://example.com/scream.jpg',
      dimensions: { width: 91, height: 73.5, unit: 'cm' },
      medium: 'Oil on canvas',
      exhibitionId: 'exhibition-2',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllArtworks', () => {
    it('should return all artworks when no filter is provided', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockArtworks);

      const result = await artworkService.getAllArtworks();

      expect(result).toEqual(mockArtworks);
      expect(jsonStorage.read).toHaveBeenCalledWith('artworks.json');
    });

    it('should filter artworks by exhibitionId', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockArtworks);

      const result = await artworkService.getAllArtworks({
        exhibitionId: 'exhibition-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array when no artworks match filter', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockArtworks);

      const result = await artworkService.getAllArtworks({
        exhibitionId: 'non-existent',
      });

      expect(result).toEqual([]);
    });
  });

  describe('getArtworkById', () => {
    it('should return artwork when found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockArtworks);

      const result = await artworkService.getArtworkById('1');

      expect(result).toEqual(mockArtworks[0]);
    });

    it('should throw ApiError when artwork not found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockArtworks);

      await expect(
        artworkService.getArtworkById('non-existent')
      ).rejects.toThrow(ApiError);
    });
  });

  describe('createArtwork', () => {
    it('should create a new artwork with required fields', async () => {
      const newArtworkData = {
        title: 'Mona Lisa',
        artist: 'Leonardo da Vinci',
        year: 1503,
        description: 'A portrait painting',
        imageUrl: 'https://example.com/mona-lisa.jpg',
        exhibitionId: 'exhibition-1',
      };

      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const artworks = [...mockArtworks];
          return updateFn(artworks);
        }
      );

      const result = await artworkService.createArtwork(newArtworkData);

      expect(result).toMatchObject({
        title: 'Mona Lisa',
        artist: 'Leonardo da Vinci',
        year: 1503,
        description: 'A portrait painting',
        imageUrl: 'https://example.com/mona-lisa.jpg',
        exhibitionId: 'exhibition-1',
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create artwork with optional dimensions and medium', async () => {
      const newArtworkData = {
        title: 'Mona Lisa',
        artist: 'Leonardo da Vinci',
        year: 1503,
        description: 'A portrait painting',
        imageUrl: 'https://example.com/mona-lisa.jpg',
        dimensions: { width: 77, height: 53, unit: 'cm' as const },
        medium: 'Oil on poplar',
        exhibitionId: 'exhibition-1',
      };

      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const artworks = [...mockArtworks];
          return updateFn(artworks);
        }
      );

      const result = await artworkService.createArtwork(newArtworkData);

      expect(result.dimensions).toEqual({ width: 77, height: 53, unit: 'cm' });
      expect(result.medium).toBe('Oil on poplar');
    });

    it('should throw ApiError when required fields are missing', async () => {
      const invalidData = {
        title: 'Test',
        artist: 'Test Artist',
        // missing year, description, imageUrl, exhibitionId
      } as any;

      await expect(artworkService.createArtwork(invalidData)).rejects.toThrow(
        ApiError
      );
    });

    it('should throw ApiError when year is negative', async () => {
      const invalidData = {
        title: 'Test',
        artist: 'Test Artist',
        year: -100,
        description: 'Test description',
        imageUrl: 'https://example.com/test.jpg',
        exhibitionId: 'exhibition-1',
      };

      await expect(artworkService.createArtwork(invalidData)).rejects.toThrow(
        ApiError
      );
    });

    it('should throw ApiError when dimensions are invalid', async () => {
      const invalidData = {
        title: 'Test',
        artist: 'Test Artist',
        year: 2000,
        description: 'Test description',
        imageUrl: 'https://example.com/test.jpg',
        dimensions: { width: -10, height: 20, unit: 'cm' as const },
        exhibitionId: 'exhibition-1',
      };

      await expect(artworkService.createArtwork(invalidData)).rejects.toThrow(
        ApiError
      );
    });
  });

  describe('updateArtwork', () => {
    it('should update artwork fields', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const artworks = [...mockArtworks];
          return updateFn(artworks);
        }
      );

      const updateData = {
        title: 'Updated Title',
        year: 1890,
      };

      const result = await artworkService.updateArtwork('1', updateData);

      expect(result.title).toBe('Updated Title');
      expect(result.year).toBe(1890);
      expect(result.artist).toBe('Vincent van Gogh'); // unchanged
    });

    it('should throw ApiError when artwork not found', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const artworks = [...mockArtworks];
          return updateFn(artworks);
        }
      );

      await expect(
        artworkService.updateArtwork('non-existent', { title: 'Test' })
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError when year is invalid', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const artworks = [...mockArtworks];
          return updateFn(artworks);
        }
      );

      await expect(
        artworkService.updateArtwork('1', { year: -100 })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('deleteArtwork', () => {
    it('should delete artwork when found', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const artworks = [...mockArtworks];
          return updateFn(artworks);
        }
      );

      await expect(
        artworkService.deleteArtwork('1')
      ).resolves.not.toThrow();
    });

    it('should throw ApiError when artwork not found', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const artworks = [...mockArtworks];
          return updateFn(artworks);
        }
      );

      await expect(
        artworkService.deleteArtwork('non-existent')
      ).rejects.toThrow(ApiError);
    });
  });
});
