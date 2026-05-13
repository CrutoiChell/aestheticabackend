import { supabase } from '../storage/supabaseClient';
import { User, UserPreferences } from '../types';
import { ApiError } from '../middleware/errorHandler';
import {
  validateRequired,
  validateEmailFormat,
} from '../utils/validation';

/**
 * User Service
 * Handles user profile operations
 */

export interface UpdateProfileData {
  name?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  preferences?: UserPreferences;
}

/**
 * Get user profile by ID
 */
export const getUserProfile = async (userId: string): Promise<Omit<User, 'passwordHash'>> => {
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
    avatarUrl: userData.avatar_url || null,
    bio: userData.bio || null,
    createdAt: userData.created_at,
    updatedAt: userData.updated_at,
  };

  // Return user without password hash
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  data: UpdateProfileData
): Promise<Omit<User, 'passwordHash'>> => {
  // Trim inputs first
  const trimmedData = {
    ...data,
    name: data.name?.trim(),
    email: data.email?.trim(),
  };

  // Validate email format if provided
  if (trimmedData.email) {
    validateRequired(trimmedData.email, 'email');
    validateEmailFormat(trimmedData.email);
  }

  // Validate name if provided
  if (trimmedData.name !== undefined) {
    validateRequired(trimmedData.name, 'name');
  }

  // Check if user exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError || !existingUser) {
    throw new ApiError(404, 'User not found', 'NOT_FOUND');
  }

  // Check if email is already taken by another user
  if (trimmedData.email && trimmedData.email !== existingUser.email) {
    const { data: emailCheck } = await supabase
      .from('users')
      .select('id')
      .eq('email', trimmedData.email)
      .neq('id', userId)
      .single();

    if (emailCheck) {
      throw new ApiError(
        400,
        'Email already in use',
        'VALIDATION_ERROR',
        { field: 'email' }
      );
    }
  }

  // Prepare update data
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  if (trimmedData.name !== undefined) updateData.name = trimmedData.name;
  if (trimmedData.email !== undefined) updateData.email = trimmedData.email;
  if (data.preferences !== undefined) updateData.preferences = data.preferences;
  if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;
  if (data.bio !== undefined) updateData.bio = data.bio;

  // Update user
  const { data: updatedUserData, error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (updateError || !updatedUserData) {
    throw new ApiError(500, 'Failed to update user profile', 'INTERNAL_ERROR');
  }

  // Convert snake_case to camelCase
  const updatedUser: User = {
    id: updatedUserData.id,
    name: updatedUserData.name,
    email: updatedUserData.email,
    passwordHash: updatedUserData.password_hash,
    role: updatedUserData.role,
    preferences: updatedUserData.preferences,
    avatarUrl: updatedUserData.avatar_url || null,
    bio: updatedUserData.bio || null,
    createdAt: updatedUserData.created_at,
    updatedAt: updatedUserData.updated_at,
  };

  // Return user without password hash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};
