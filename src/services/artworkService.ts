import { supabase } from '../storage/supabaseClient';
import { Artwork } from '../types';
import { ApiError } from '../middleware/errorHandler';
import { validateRequired } from '../utils/validation';

/**
 * Artwork Service
 * Handles CRUD operations for artworks
 */

export interface ArtworkSearchParams {
  exhibitionId?: string;
}

export interface CreateArtworkData {
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
}

export interface UpdateArtworkData {
  title?: string;
  artist?: string;
  year?: number;
  description?: string;
  imageUrl?: string;
  dimensions?: {
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  medium?: string;
  exhibitionId?: string;
}

/**
 * Get all artworks with optional filter by exhibition
 */
export const getAllArtworks = async (
  params: ArtworkSearchParams = {}
): Promise<Artwork[]> => {
  let query = supabase.from('artworks').select('*');

  // Apply exhibition filter
  if (params.exhibitionId) {
    query = query.eq('exhibition_id', params.exhibitionId);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, 'Failed to fetch artworks', 'INTERNAL_ERROR');
  }

  // Convert snake_case to camelCase
  return (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    artist: item.artist,
    year: item.year,
    description: item.description,
    imageUrl: item.image_url,
    dimensions: item.width && item.height ? {
      width: item.width,
      height: item.height,
      unit: item.dimension_unit,
    } : undefined,
    medium: item.medium,
    exhibitionId: item.exhibition_id,
    userId: item.user_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
};

/**
 * Get a single artwork by ID
 */
export const getArtworkById = async (id: string): Promise<Artwork> => {
  const { data, error } = await supabase
    .from('artworks')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Artwork not found', 'NOT_FOUND');
  }

  // Convert snake_case to camelCase
  return {
    id: data.id,
    title: data.title,
    artist: data.artist,
    year: data.year,
    description: data.description,
    imageUrl: data.image_url,
    dimensions: data.width && data.height ? {
      width: data.width,
      height: data.height,
      unit: data.dimension_unit,
    } : undefined,
    medium: data.medium,
    exhibitionId: data.exhibition_id,
    userId: data.user_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

/**
 * Create a new artwork
 */
export const createArtwork = async (
  data: CreateArtworkData,
  userId: string,
  userRole: string
): Promise<Artwork> => {
  // Validate required fields
  validateRequired(data.title, 'title');
  validateRequired(data.artist, 'artist');
  validateRequired(data.year, 'year');
  validateRequired(data.description, 'description');
  validateRequired(data.imageUrl, 'imageUrl');
  validateRequired(data.exhibitionId, 'exhibitionId');

  // Check if user owns the exhibition, is admin, or exhibition allows user images
  const { data: exhibition, error: exhibitionError } = await supabase
    .from('exhibitions')
    .select('*')
    .eq('id', data.exhibitionId)
    .single();

  if (exhibitionError || !exhibition) {
    throw new ApiError(404, 'Exhibition not found', 'NOT_FOUND');
  }

  const isOwner = exhibition.user_id === userId;
  const isAdmin = userRole === 'admin';
  // allow_user_images may not exist in old schema — treat missing as false
  const allowsContributions = Boolean(exhibition.allow_user_images);

  if (!isOwner && !isAdmin && !allowsContributions) {
    throw new ApiError(403, 'Нет прав на добавление артов в эту выставку', 'FORBIDDEN');
  }

  // Validate year is a positive number
  if (typeof data.year !== 'number' || data.year < 0) {
    throw new ApiError(
      400,
      'Year must be a positive number',
      'VALIDATION_ERROR',
      { field: 'year' }
    );
  }

  // Validate dimensions if provided
  if (data.dimensions) {
    if (
      typeof data.dimensions.width !== 'number' ||
      data.dimensions.width <= 0
    ) {
      throw new ApiError(
        400,
        'Dimensions width must be a positive number',
        'VALIDATION_ERROR',
        { field: 'dimensions.width' }
      );
    }
    if (
      typeof data.dimensions.height !== 'number' ||
      data.dimensions.height <= 0
    ) {
      throw new ApiError(
        400,
        'Dimensions height must be a positive number',
        'VALIDATION_ERROR',
        { field: 'dimensions.height' }
      );
    }
    if (!['cm', 'in'].includes(data.dimensions.unit)) {
      throw new ApiError(
        400,
        'Dimensions unit must be "cm" or "in"',
        'VALIDATION_ERROR',
        { field: 'dimensions.unit' }
      );
    }
  }

  // Create new artwork — try with user_id first, fall back without it
  const baseInsert: Record<string, unknown> = {
    title: data.title.trim(),
    artist: data.artist.trim(),
    year: data.year,
    description: data.description.trim(),
    image_url: data.imageUrl.trim(),
    width: data.dimensions?.width,
    height: data.dimensions?.height,
    dimension_unit: data.dimensions?.unit,
    medium: data.medium?.trim(),
    exhibition_id: data.exhibitionId,
  };

  let newArtwork: any = null;
  let insertError: any = null;

  // Try with user_id
  const { data: withUser, error: errWithUser } = await supabase
    .from('artworks')
    .insert({ ...baseInsert, user_id: userId })
    .select()
    .single();

  if (!errWithUser && withUser) {
    newArtwork = withUser;
  } else {
    // Fallback: without user_id (old schema)
    const { data: withoutUser, error: errWithoutUser } = await supabase
      .from('artworks')
      .insert(baseInsert)
      .select()
      .single();
    newArtwork = withoutUser;
    insertError = errWithoutUser;
  }

  if (insertError || !newArtwork) {
    throw new ApiError(500, insertError?.message || 'Failed to create artwork', 'INTERNAL_ERROR');
  }

  return {
    id: newArtwork.id,
    title: newArtwork.title,
    artist: newArtwork.artist,
    year: newArtwork.year,
    description: newArtwork.description,
    imageUrl: newArtwork.image_url,
    dimensions: newArtwork.width && newArtwork.height ? {
      width: newArtwork.width,
      height: newArtwork.height,
      unit: newArtwork.dimension_unit,
    } : undefined,
    medium: newArtwork.medium,
    exhibitionId: newArtwork.exhibition_id,
    userId: newArtwork.user_id || userId,
    createdAt: newArtwork.created_at,
    updatedAt: newArtwork.updated_at,
  };
};

/**
 * Update an existing artwork
 */
export const updateArtwork = async (
  id: string,
  data: UpdateArtworkData,
  userId: string,
  userRole: string
): Promise<Artwork> => {
  // Check if user owns the artwork or is admin
  const { data: artwork, error: artworkError } = await supabase
    .from('artworks')
    .select('user_id')
    .eq('id', id)
    .single();

  if (artworkError || !artwork) {
    throw new ApiError(404, 'Artwork not found', 'NOT_FOUND');
  }

  if (artwork.user_id !== userId && userRole !== 'admin') {
    throw new ApiError(403, 'Нет прав на редактирование этого арта', 'FORBIDDEN');
  }

  // Validate year if provided
  if (data.year !== undefined) {
    if (typeof data.year !== 'number' || data.year < 0) {
      throw new ApiError(
        400,
        'Year must be a positive number',
        'VALIDATION_ERROR',
        { field: 'year' }
      );
    }
  }

  // Validate dimensions if provided
  if (data.dimensions) {
    if (
      typeof data.dimensions.width !== 'number' ||
      data.dimensions.width <= 0
    ) {
      throw new ApiError(
        400,
        'Dimensions width must be a positive number',
        'VALIDATION_ERROR',
        { field: 'dimensions.width' }
      );
    }
    if (
      typeof data.dimensions.height !== 'number' ||
      data.dimensions.height <= 0
    ) {
      throw new ApiError(
        400,
        'Dimensions height must be a positive number',
        'VALIDATION_ERROR',
        { field: 'dimensions.height' }
      );
    }
    if (!['cm', 'in'].includes(data.dimensions.unit)) {
      throw new ApiError(
        400,
        'Dimensions unit must be "cm" or "in"',
        'VALIDATION_ERROR',
        { field: 'dimensions.unit' }
      );
    }
  }

  // Prepare update data
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.artist !== undefined) updateData.artist = data.artist.trim();
  if (data.year !== undefined) updateData.year = data.year;
  if (data.description !== undefined) updateData.description = data.description.trim();
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl.trim();
  if (data.dimensions !== undefined) {
    updateData.width = data.dimensions.width;
    updateData.height = data.dimensions.height;
    updateData.dimension_unit = data.dimensions.unit;
  }
  if (data.medium !== undefined) updateData.medium = data.medium.trim();
  if (data.exhibitionId !== undefined) updateData.exhibition_id = data.exhibitionId;

  // Update artwork
  const { data: updated, error } = await supabase
    .from('artworks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    throw new ApiError(404, 'Artwork not found', 'NOT_FOUND');
  }

  // Convert snake_case to camelCase
  return {
    id: updated.id,
    title: updated.title,
    artist: updated.artist,
    year: updated.year,
    description: updated.description,
    imageUrl: updated.image_url,
    dimensions: updated.width && updated.height ? {
      width: updated.width,
      height: updated.height,
      unit: updated.dimension_unit,
    } : undefined,
    medium: updated.medium,
    exhibitionId: updated.exhibition_id,
    userId: updated.user_id,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
};

/**
 * Delete an artwork
 */
export const deleteArtwork = async (
  id: string,
  userId: string,
  userRole: string
): Promise<void> => {
  // Check if user owns the artwork or is admin
  const { data: artwork, error: artworkError } = await supabase
    .from('artworks')
    .select('user_id')
    .eq('id', id)
    .single();

  if (artworkError || !artwork) {
    throw new ApiError(404, 'Artwork not found', 'NOT_FOUND');
  }

  if (artwork.user_id !== userId && userRole !== 'admin') {
    throw new ApiError(403, 'Нет прав на удаление этого арта', 'FORBIDDEN');
  }

  const { error } = await supabase
    .from('artworks')
    .delete()
    .eq('id', id);

  if (error) {
    throw new ApiError(404, 'Artwork not found', 'NOT_FOUND');
  }
};
