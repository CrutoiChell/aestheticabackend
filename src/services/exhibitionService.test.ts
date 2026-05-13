import {
  getAllExhibitions,
  getExhibitionById,
  createExhibition,
  updateExhibition,
  deleteExhibition,
  CreateExhibitionData,
  UpdateExhibitionData,
  ExhibitionSearchParams,
} from './exhibitionService';
import { jsonStorage } from '../storage/jsonStorage';
import { Exhibition } from '../types';
import { ApiError } from '../middleware/errorHandler';

// Mock the jsonStorage module
jest.mock('../storage/jsonStorage');

describe('ExhibitionService', () => {
  const mockExhibitions: Exhibition[] = [
    {
      id: '1',
      title: 'Modern Art Exhibition',
      description: 'A collection of modern art pieces',
      gallery: 'Gallery A',
      startDate: '2024-01-01',
      endDate: '2024-03-01',
      imageUrl: 'https://example.com/image1.jpg',
      location: 'New York',
      artworkIds: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      title: 'Classical Paintings',
      description: 'Renaissance and Baroque masterpieces',
      gallery: 'Gallery B',
      startDate: '2024-02-01',
      endDate: '2024-04-01',
      imageUrl: 'https://example.com/image2.jpg',
      artworkIds: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllExhibitions', () => {
    it('should return all exhibitions when no filters are applied', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockExhibitions);

      const result = await getAllExhibitions();

      expect(result).toEqual(mockExhibitions);
      expect(jsonStorage.read).toHaveBeenCalledWith('exhibitions.json');
    });

    it('should filter exhibitions by search query', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockExhibitions);

      const params: ExhibitionSearchParams = { search: 'modern' };
      const result = await getAllExhibitions(params);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Modern Art Exhibition');
    });

    it('should filter exhibitions by gallery', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockExhibitions);

      const params: ExhibitionSearchParams = { gallery: 'Gallery B' };
      const result = await getAllExhibitions(params);

      expect(result).toHaveLength(1);
      expect(result[0].gallery).toBe('Gallery B');
    });

    it('should filter exhibitions by date range', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockExhibitions);

      const params: ExhibitionSearchParams = {
        startDate: '2024-01-15',
        endDate: '2024-02-15',
      };
      const result = await getAllExhibitions(params);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no exhibitions match filters', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockExhibitions);

      const params: ExhibitionSearchParams = { search: 'nonexistent' };
      const result = await getAllExhibitions(params);

      expect(result).toHaveLength(0);
    });
  });

  describe('getExhibitionById', () => {
    it('should return exhibition when found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockExhibitions);

      const result = await getExhibitionById('1');

      expect(result).toEqual(mockExhibitions[0]);
    });

    it('should throw ApiError when exhibition not found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue(mockExhibitions);

      await expect(getExhibitionById('999')).rejects.toThrow(ApiError);
      await expect(getExhibitionById('999')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('createExhibition', () => {
    const validData: CreateExhibitionData = {
      title: 'New Exhibition',
      description: 'A new art exhibition',
      gallery: 'Gallery C',
      startDate: '2024-05-01',
      endDate: '2024-06-01',
      imageUrl: 'https://example.com/image3.jpg',
      location: 'Paris',
    };

    it('should create a new exhibition with valid data', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const exhibitions = [...mockExhibitions];
          return updateFn(exhibitions);
        }
      );

      const result = await createExhibition(validData);

      expect(result).toMatchObject({
        title: validData.title,
        description: validData.description,
        gallery: validData.gallery,
        startDate: validData.startDate,
        endDate: validData.endDate,
        imageUrl: validData.imageUrl,
        location: validData.location,
        artworkIds: [],
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw error when required fields are missing', async () => {
      const invalidData = { ...validData, title: '' };

      await expect(createExhibition(invalidData)).rejects.toThrow(ApiError);
    });

    it('should throw error when end date is before start date', async () => {
      const invalidData = {
        ...validData,
        startDate: '2024-06-01',
        endDate: '2024-05-01',
      };

      await expect(createExhibition(invalidData)).rejects.toThrow(ApiError);
      await expect(createExhibition(invalidData)).rejects.toMatchObject({
        message: 'End date must be after start date',
      });
    });

    it('should throw error when date format is invalid', async () => {
      const invalidData = {
        ...validData,
        startDate: 'invalid-date',
      };

      await expect(createExhibition(invalidData)).rejects.toThrow(ApiError);
    });
  });

  describe('updateExhibition', () => {
    it('should update exhibition with valid data', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          return updateFn([...mockExhibitions]);
        }
      );

      const updateData: UpdateExhibitionData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const result = await updateExhibition('1', updateData);

      expect(result.title).toBe('Updated Title');
      expect(result.description).toBe('Updated description');
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw error when exhibition not found', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          return updateFn([...mockExhibitions]);
        }
      );

      await expect(
        updateExhibition('999', { title: 'Updated' })
      ).rejects.toThrow(ApiError);
    });

    it('should throw error when updated dates are invalid', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          return updateFn([...mockExhibitions]);
        }
      );

      const updateData: UpdateExhibitionData = {
        startDate: '2024-06-01',
        endDate: '2024-05-01',
      };

      await expect(updateExhibition('1', updateData)).rejects.toThrow(ApiError);
    });
  });

  describe('deleteExhibition', () => {
    it('should delete exhibition when found', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          return updateFn([...mockExhibitions]);
        }
      );

      await expect(deleteExhibition('1')).resolves.not.toThrow();
      expect(jsonStorage.update).toHaveBeenCalled();
    });

    it('should throw error when exhibition not found', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          return updateFn([...mockExhibitions]);
        }
      );

      await expect(deleteExhibition('999')).rejects.toThrow(ApiError);
      await expect(deleteExhibition('999')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
