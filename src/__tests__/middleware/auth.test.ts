import { Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthRequest } from '../../types';
import { authService } from '../../services/authService';

// Mock authService
jest.mock('../../services/authService');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should call next() with valid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken123',
      };

      const mockPayload = {
        userId: '123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600,
      };

      (authService.verifyToken as jest.Mock).mockReturnValue(mockPayload);

      authenticate(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(authService.verifyToken).toHaveBeenCalledWith('validtoken123');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next with error if no authorization header', () => {
      mockRequest.headers = {};

      authenticate(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('No authorization token provided');
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should call next with error if authorization format is invalid', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token123',
      };

      authenticate(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Invalid authorization format. Use: Bearer <token>');
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should call next with error if token verification fails', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalidtoken',
      };

      (authService.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authenticate(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeDefined();
    });

    it('should call next with error if token is expired', () => {
      mockRequest.headers = {
        authorization: 'Bearer expiredtoken',
      };

      (authService.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      authenticate(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeDefined();
    });
  });

  describe('requireAdmin', () => {
    it('should call next() if user is admin', () => {
      mockRequest.user = {
        userId: '123',
        email: 'admin@example.com',
        role: 'admin',
        iat: Date.now(),
        exp: Date.now() + 3600,
      };

      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      mockRequest.user = undefined;

      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication required');
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should call next with error if user is not admin', () => {
      mockRequest.user = {
        userId: '123',
        email: 'user@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600,
      };

      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Admin access required');
      expect(error.code).toBe('FORBIDDEN');
    });
  });
});
