import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { authService } from '../services/authService';
import { ApiError } from './errorHandler';

/**
 * JWT verification middleware
 * Validates the JWT token from the Authorization header
 * Attaches the decoded user payload to req.user
 */
export const authenticate = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new ApiError(401, 'No authorization token provided', 'UNAUTHORIZED');
    }

    // Check if token follows Bearer scheme
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new ApiError(401, 'Invalid authorization format. Use: Bearer <token>', 'UNAUTHORIZED');
    }

    const token = parts[1];

    // Verify token (will throw ApiError if invalid)
    const decoded = authService.verifyToken(token);
    
    // Attach user payload to request
    req.user = decoded;
    
    next();
  } catch (error) {
    // Pass error to error handler middleware
    next(error);
  }
};

/**
 * Admin role verification middleware
 * Must be used after authenticate middleware
 * Checks if the authenticated user has admin role
 */
export const requireAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    if (req.user.role !== 'admin') {
      throw new ApiError(403, 'Admin access required', 'FORBIDDEN');
    }

    next();
  } catch (error) {
    next(error);
  }
};
