import { AuthService } from './authService';
import { jsonStorage } from '../storage/jsonStorage';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../types';

// Mock dependencies
jest.mock('../storage/jsonStorage');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  const mockUsers: User[] = [];

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
    mockUsers.length = 0;
  });

  describe('register', () => {
    it('should register a new user with hashed password', async () => {
      const registerData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      (jsonStorage.read as jest.Mock).mockResolvedValue([]);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (jsonStorage.update as jest.Mock).mockImplementation(async (filename, updateFn) => {
        const users = await jsonStorage.read(filename);
        return updateFn(users);
      });
      (jwt.sign as jest.Mock).mockReturnValue('mock_token');

      const result = await authService.register(registerData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('john@example.com');
      expect(result.user.name).toBe('John Doe');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(jwt.sign).toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      const existingUser: User = {
        id: '1',
        name: 'Existing User',
        email: 'john@example.com',
        passwordHash: 'hashed',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (jsonStorage.read as jest.Mock).mockResolvedValue([existingUser]);

      await expect(
        authService.register({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should throw error if password is too short', async () => {
      await expect(
        authService.register({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'short',
        })
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should throw error if required fields are missing', async () => {
      await expect(
        authService.register({
          name: '',
          email: 'john@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Name, email, and password are required');
    });

    it('should normalize email to lowercase', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (jsonStorage.update as jest.Mock).mockImplementation(async (filename, updateFn) => {
        const users = await jsonStorage.read(filename);
        return updateFn(users);
      });
      (jwt.sign as jest.Mock).mockReturnValue('mock_token');

      const result = await authService.register({
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        password: 'password123',
      });

      expect(result.user.email).toBe('john@example.com');
    });
  });

  describe('login', () => {
    const mockUser: User = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      passwordHash: 'hashed_password',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should login user with valid credentials', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock_token');

      const result = await authService.login({
        email: 'john@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('john@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should throw error if user not found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if password is incorrect', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'john@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if email or password is missing', async () => {
      await expect(
        authService.login({
          email: '',
          password: 'password123',
        })
      ).rejects.toThrow('Email and password are required');
    });

    it('should handle case-insensitive email login', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock_token');

      const result = await authService.login({
        email: 'JOHN@EXAMPLE.COM',
        password: 'password123',
      });

      expect(result.user.email).toBe('john@example.com');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const mockPayload = {
        userId: '1',
        email: 'john@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = authService.verifyToken('valid_token');

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith('valid_token', expect.any(String));
    });

    it('should throw error for expired token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      expect(() => authService.verifyToken('expired_token')).toThrow('Token expired');
    });

    it('should throw error for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      expect(() => authService.verifyToken('invalid_token')).toThrow('Invalid token');
    });

    it('should throw generic error for other verification failures', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Unknown error');
      });

      expect(() => authService.verifyToken('bad_token')).toThrow('Token verification failed');
    });
  });

  describe('getUserById', () => {
    const mockUser: User = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      passwordHash: 'hashed_password',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should return user without password hash', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([mockUser]);

      const result = await authService.getUserById('1');

      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('email', 'john@example.com');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      (jsonStorage.read as jest.Mock).mockResolvedValue([]);

      await expect(authService.getUserById('nonexistent')).rejects.toThrow('User not found');
    });
  });
});
