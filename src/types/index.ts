import { Request } from 'express';

// User types
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  avatarUrl?: string | null;
  bio?: string | null;
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  favoriteArtists?: string[];
  favoriteStyles?: string[];
  notificationEnabled: boolean;
}

// Exhibition types
export interface Exhibition {
  id: string;
  title: string;
  description: string;
  gallery: string;
  startDate: string;
  endDate: string;
  imageUrl: string;
  /** All gallery images in order */
  imageUrls: string[];
  location?: string;
  artworkIds: string[];
  userId: string;
  authorName?: string;
  isPublic: boolean;
  /** If true, any authenticated user may POST /exhibitions/:id/user-images */
  allowUserImages: boolean;
  likesCount: number;
  commentsCount: number;
  artworksCount: number;
  createdAt: string;
  updatedAt: string;
}

// Like types
export interface Like {
  id: string;
  userId: string;
  exhibitionId: string;
  createdAt: string;
}

// Comment types
export interface Comment {
  id: string;
  userId: string;
  exhibitionId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  userName?: string;
}

// Artwork types
export interface Artwork {
  id: string;
  title: string;
  artist: string;
  year: number;
  description: string;
  imageUrl: string;
  dimensions?: {
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  medium?: string;
  exhibitionId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Express Request extension
export interface AuthRequest extends Request {
  user?: JWTPayload;
}

// Form types
export interface ExhibitionFormData {
  title: string;
  description: string;
  gallery: string;
  startDate: string;
  endDate: string;
  imageUrl: string;
  location?: string;
}

export interface ArtworkFormData {
  title: string;
  artist: string;
  year: number;
  description: string;
  imageUrl: string;
  exhibitionId: string;
  dimensions?: {
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  medium?: string;
}

// Filter types
export interface FilterOptions {
  search?: string;
  gallery?: string;
  startDate?: string;
  endDate?: string;
}

// User profile update types
export interface UserProfileUpdateData {
  name?: string;
  email?: string;
  preferences?: UserPreferences;
}

// API Error types
export interface ApiError {
  message: string;
  code: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationErrorResponse {
  success: false;
  error: {
    message: string;
    code: 'VALIDATION_ERROR';
    details: ValidationError[];
  };
}
