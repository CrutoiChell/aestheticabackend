import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { RegisterData, LoginCredentials, AuthRequest } from '../types';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 * Body: { name: string, email: string, password: string }
 * Response: { success: true, data: { user: User, token: string } }
 */
router.post('/register', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const registerData: RegisterData = req.body;

  // Validate required fields
  if (!registerData.name || !registerData.email || !registerData.password) {
    throw new ApiError(
      400,
      'Name, email, and password are required',
      'VALIDATION_ERROR',
      [
        { field: 'name', message: 'Name is required' },
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is required' },
      ]
    );
  }

  // Register user
  const authResponse = await authService.register(registerData);

  res.status(201).json({
    success: true,
    data: authResponse,
  });
}));

/**
 * POST /api/auth/login
 * Login with email and password
 * Body: { email: string, password: string }
 * Response: { success: true, data: { user: User, token: string } }
 */
router.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const credentials: LoginCredentials = req.body;

  // Validate required fields
  if (!credentials.email || !credentials.password) {
    throw new ApiError(
      400,
      'Email and password are required',
      'VALIDATION_ERROR',
      [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is required' },
      ]
    );
  }

  // Login user
  const authResponse = await authService.login(credentials);

  res.status(200).json({
    success: true,
    data: authResponse,
  });
}));

/**
 * GET /api/auth/me
 * Get current authenticated user
 * Headers: { Authorization: "Bearer <token>" }
 * Response: { success: true, data: { user: User } }
 */
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
  }

  // Get user by ID from token
  const user = await authService.getUserById(req.user.userId);

  res.status(200).json({
    success: true,
    data: { user },
  });
}));

export default router;
