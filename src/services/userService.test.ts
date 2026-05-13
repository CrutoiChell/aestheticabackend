import * as userService from './userService';
import { jsonStorage } from '../storage/jsonStorage';
import { User } from '../types';
import { ApiError } from '../middleware/errorHandler';

// Mock dependencies
jest.mock('../storage/jsonStorage');

describe('UserService', () => {
  const mockUser: User = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    passwordHash: 'hashed_password',
    role: 'user',
    preferences: {
      favoriteArtists: ['Artist 1'],
      favoriteStyles: ['Modern'],
      notificationEnabled: true,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return user profile without password hash', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);

      const result = await userService.getUserProfile('1');

      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('name', 'John Doe');
      expect(result).toHaveProperty('email', 'john@example.com');
      expect(result).toHaveProperty('preferences');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);

      await expect(userService.getUserProfile('nonexistent')).rejects.toThrow(
        ApiError
      );
      await expect(userService.getUserProfile('nonexistent')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should update user name', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const users = [mockUser];
          return updateFn(users);
        }
      );

      const result = await userService.updateUserProfile('1', {
        name: 'Jane Doe',
      });

      expect(result).toHaveProperty('name', 'Jane Doe');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should update user email', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const users = [mockUser];
          return updateFn(users);
        }
      );

      const result = await userService.updateUserProfile('1', {
        email: 'newemail@example.com',
      });

      expect(result).toHaveProperty('email', 'newemail@example.com');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should update user preferences', async () => {
      const newPreferences = {
        favoriteArtists: ['Artist 2', 'Artist 3'],
        favoriteStyles: ['Contemporary'],
        notificationEnabled: false,
      };

      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const users = [mockUser];
          return updateFn(users);
        }
      );

      const result = await userService.updateUserProfile('1', {
        preferences: newPreferences,
      });

      expect(result).toHaveProperty('preferences', newPreferences);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should update multiple fields at once', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const users = [mockUser];
          return updateFn(users);
        }
      );

      const result = await userService.updateUserProfile('1', {
        name: 'Jane Doe',
        email: 'jane@example.com',
        preferences: {
          favoriteArtists: [],
          favoriteStyles: [],
          notificationEnabled: false,
        },
      });

      expect(result).toHaveProperty('name', 'Jane Doe');
      expect(result).toHaveProperty('email', 'jane@example.com');
      expect(result.preferences?.notificationEnabled).toBe(false);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const users: User[] = [];
          return updateFn(users);
        }
      );

      await expect(
        userService.updateUserProfile('nonexistent', { name: 'Test' })
      ).rejects.toThrow(ApiError);
      await expect(
        userService.updateUserProfile('nonexistent', { name: 'Test' })
      ).rejects.toThrow('User not found');
    });

    it('should throw error if email is already taken', async () => {
      const anotherUser: User = {
        ...mockUser,
        id: '2',
        email: 'another@example.com',
      };

      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const users = [mockUser, anotherUser];
          return updateFn(users);
        }
      );

      await expect(
        userService.updateUserProfile('1', { email: 'another@example.com' })
      ).rejects.toThrow(ApiError);
      await expect(
        userService.updateUserProfile('1', { email: 'another@example.com' })
      ).rejects.toThrow('Email already in use');
    });

    it('should throw error if email format is invalid', async () => {
      await expect(
        userService.updateUserProfile('1', { email: 'invalid-email' })
      ).rejects.toThrow(ApiError);
      await expect(
        userService.updateUserProfile('1', { email: 'invalid-email' })
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error if name is empty', async () => {
      await expect(
        userService.updateUserProfile('1', { name: '' })
      ).rejects.toThrow(ApiError);
      await expect(
        userService.updateUserProfile('1', { name: '' })
      ).rejects.toThrow('name is required');
    });

    it('should trim whitespace from name and email', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const users = [mockUser];
          return updateFn(users);
        }
      );

      const result = await userService.updateUserProfile('1', {
        name: '  Jane Doe  ',
        email: '  jane@example.com  ',
      });

      expect(result).toHaveProperty('name', 'Jane Doe');
      expect(result).toHaveProperty('email', 'jane@example.com');
    });

    it('should allow updating email to the same email', async () => {
      (jsonStorage.update as jest.Mock).mockImplementation(
        async (_filename, updateFn) => {
          const users = [mockUser];
          return updateFn(users);
        }
      );

      const result = await userService.updateUserProfile('1', {
        email: 'john@example.com',
      });

      expect(result).toHaveProperty('email', 'john@example.com');
    });
  });
});
