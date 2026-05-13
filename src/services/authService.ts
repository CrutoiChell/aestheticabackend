import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../storage/supabaseClient';
import { User, RegisterData, LoginCredentials, AuthResponse, JWTPayload } from '../types';
import { ApiError } from '../middleware/errorHandler';

const SALT_ROUNDS = 10;
const JWT_SECRET: string = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Authentication Service
 * Handles user registration, login, and token verification
 */
export class AuthService {
  /**
   * Register a new user with password hashing
   * @param data - Registration data (name, email, password)
   * @returns AuthResponse with user and token
   * @throws ApiError if email already exists or validation fails
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const { name, email, password } = data;

    // Validate input
    if (!name || !email || !password) {
      throw new ApiError(
        400,
        'Name, email, and password are required',
        'VALIDATION_ERROR'
      );
    }

    if (password.length < 8) {
      throw new ApiError(
        400,
        'Password must be at least 8 characters',
        'VALIDATION_ERROR',
        { field: 'password' }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();
    
    if (existingUser) {
      throw new ApiError(
        400,
        'Email already registered',
        'VALIDATION_ERROR',
        { field: 'email' }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: 'user',
      })
      .select()
      .single();

    if (error || !newUser) {
      throw new ApiError(500, 'Failed to create user', 'INTERNAL_ERROR');
    }

    // Convert snake_case to camelCase
    const user: User = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      passwordHash: newUser.password_hash,
      role: newUser.role,
      preferences: newUser.preferences,
      createdAt: newUser.created_at,
      updatedAt: newUser.updated_at,
    };

    // Generate JWT token
    const token = this.generateToken(user);

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      token,
    };
  }

  /**
   * Login user with email and password
   * @param credentials - Login credentials (email, password)
   * @returns AuthResponse with user and token
   * @throws ApiError if credentials are invalid
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;

    // Validate input
    if (!email || !password) {
      throw new ApiError(
        400,
        'Email and password are required',
        'VALIDATION_ERROR'
      );
    }

    // Find user by email
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !userData) {
      throw new ApiError(401, 'Invalid credentials', 'UNAUTHORIZED');
    }

    // Convert snake_case to camelCase
    const user: User = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      passwordHash: userData.password_hash,
      role: userData.role,
      preferences: userData.preferences,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    };

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid credentials', 'UNAUTHORIZED');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  /**
   * Verify JWT token and return decoded payload
   * @param token - JWT token to verify
   * @returns Decoded JWT payload
   * @throws ApiError if token is invalid or expired
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Token expired', 'TOKEN_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid token', 'INVALID_TOKEN');
      }
      throw new ApiError(401, 'Token verification failed', 'UNAUTHORIZED');
    }
  }

  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User without password hash
   * @throws ApiError if user not found
   */
  async getUserById(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      throw new ApiError(404, 'User not found', 'NOT_FOUND');
    }

    // Convert snake_case to camelCase
    const user: User = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      passwordHash: userData.password_hash,
      role: userData.role,
      preferences: userData.preferences,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    };

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Generate JWT token for user
   * @param user - User object
   * @returns JWT token string
   */
  private generateToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }
}

// Export singleton instance
export const authService = new AuthService();
