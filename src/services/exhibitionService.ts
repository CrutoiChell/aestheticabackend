import { supabase } from '../storage/supabaseClient';
import { Exhibition } from '../types';
import { ApiError } from '../middleware/errorHandler';
import {
  validateRequired,
  validateDate,
} from '../utils/validation';

/**
 * Exhibition Service
 * Handles CRUD operations, search, and filtering for exhibitions
 */

export interface ExhibitionSearchParams {
  search?: string;
  gallery?: string;
  startDate?: string;
  endDate?: string;
  /** If set with limit, returns a slice for pagination (max 100 per page) */
  limit?: number;
  offset?: number;
}

export interface CreateExhibitionData {
  title: string;
  description: string;
  gallery: string;
  /** Optional; defaults to today / +1 year on server */
  startDate?: string;
  endDate?: string;
  imageUrl: string;
  /** Optional ordered list (e.g. from multi-upload); first doubles as primary cover */
  imageUrls?: string[];
  location?: string;
  userId: string;
  isPublic?: boolean;
  /** Other users may add photos (requires DB column allow_user_images) */
  allowUserImages?: boolean;
}

export interface UpdateExhibitionData {
  title?: string;
  description?: string;
  gallery?: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  imageUrls?: string[];
  location?: string;
  isPublic?: boolean;
  allowUserImages?: boolean;
}

function dedupePreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/** Build ordered URLs for INSERT/UPDATE */
function normalizeGalleryUrlsForWrite(data: { imageUrl: string; imageUrls?: string[] }): string[] {
  const seeds = data.imageUrls?.length ? [...data.imageUrls] : [data.imageUrl];
  const trimmed = seeds.map((u) => String(u).trim()).filter(Boolean);
  return dedupePreserveOrder(trimmed);
}

function parseGalleryImageUrls(row: Record<string, any>): string[] {
  const main =
    typeof row.image_url === 'string' && row.image_url.trim()
      ? String(row.image_url).trim()
      : '';
  const raw = row.gallery_image_urls;

  let fromGallery: string[] = [];
  if (Array.isArray(raw)) {
    fromGallery = raw
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) {
        fromGallery = p
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }

  if (fromGallery.length) return dedupePreserveOrder(fromGallery);
  return main ? [main] : [];
}

function mapExhibitionRow(
  row: Record<string, any>,
  options?: { extraImageUrls?: string[] }
): Exhibition {
  const imageUrls = parseGalleryImageUrls(row);
  const imageUrl = imageUrls[0] || '';
  let merged = imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [];
  if (options?.extraImageUrls?.length) {
    for (const u of options.extraImageUrls) {
      if (u && !merged.includes(u)) merged.push(u);
    }
  }
  // Author name from joined users table
  const authorName = row.users?.name || undefined;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    gallery: row.gallery,
    startDate: row.start_date,
    endDate: row.end_date,
    imageUrl,
    imageUrls: merged.length ? merged : imageUrl ? [imageUrl] : [],
    location: row.location,
    artworkIds: [],
    userId: row.user_id,
    authorName,
    isPublic: row.is_public,
    allowUserImages: Boolean(row.allow_user_images),
    likesCount: row.likes_count || 0,
    commentsCount: row.comments_count || 0,
    artworksCount: row.artworks_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function defaultExhibitionDates(): { startDate: string; endDate: string } {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function fetchContributionImageUrls(exhibitionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('exhibition_user_images')
    .select('image_url')
    .eq('exhibition_id', exhibitionId)
    .order('created_at', { ascending: true });

  if (error) {
    return [];
  }
  return (data || []).map((r: { image_url: string }) => r.image_url).filter(Boolean);
}

export interface ExhibitionListResult {
  exhibitions: Exhibition[];
  /** Total rows matching filters (for pagination) */
  total: number;
}

/**
 * Get all exhibitions with optional search, filter, and pagination
 */
export const getAllExhibitions = async (
  params: ExhibitionSearchParams = {}
): Promise<ExhibitionListResult> => {
  let query = supabase.from('exhibitions').select('*, users(id, name)', { count: 'exact' });

  // Only show public exhibitions by default
  query = query.eq('is_public', true);

  // Apply search filter (searches in title, description, and gallery)
  if (params.search) {
    // Escape special PostgREST characters to avoid query injection:
    // ( , ) . : = * need to be stripped or escaped.
    const safe = params.search
      .replace(/[,():*"]/g, ' ')
      .replace(/\\/g, '')
      .trim()
      .slice(0, 80);
    if (safe) {
      const q = safe.toLowerCase();
      query = query.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,gallery.ilike.%${q}%`
      );
    }
  }

  // Apply gallery filter
  if (params.gallery) {
    query = query.ilike('gallery', params.gallery);
  }

  // Apply date range filter
  if (params.startDate) {
    query = query.gte('end_date', params.startDate);
  }

  if (params.endDate) {
    query = query.lte('start_date', params.endDate);
  }

  query = query.order('created_at', { ascending: false });

  const limitRaw = params.limit;
  const hasLimit =
    limitRaw !== undefined && limitRaw !== null && !Number.isNaN(Number(limitRaw));
  const limit = hasLimit
    ? Math.min(Math.max(Math.floor(Number(limitRaw)), 1), 100)
    : undefined;
  const offset =
    limit !== undefined ? Math.max(Math.floor(Number(params.offset) || 0), 0) : 0;

  if (limit !== undefined) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new ApiError(500, 'Failed to fetch exhibitions', 'INTERNAL_ERROR');
  }

  const exhibitions = (data || []).map((row: Record<string, unknown>) =>
    mapExhibitionRow(row as Record<string, any>)
  );
  const total = typeof count === 'number' ? count : exhibitions.length;

  return { exhibitions, total };
};

/**
 * Get a single exhibition by ID (merges visitor-uploaded images when present)
 */
export const getExhibitionById = async (id: string): Promise<Exhibition> => {
  const { data, error } = await supabase
    .from('exhibitions')
    .select('*, users(id, name)')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Exhibition not found', 'NOT_FOUND');
  }

  const extra = await fetchContributionImageUrls(id);
  return mapExhibitionRow(data as Record<string, any>, {
    extraImageUrls: extra.length ? extra : undefined,
  });
};

/**
 * Create a new exhibition
 */
export const createExhibition = async (
  data: CreateExhibitionData
): Promise<Exhibition> => {
  validateRequired(data.title, 'title');
  validateRequired(data.description, 'description');
  validateRequired(data.gallery, 'gallery');
  validateRequired(data.imageUrl, 'imageUrl');

  let startDate = data.startDate?.trim();
  let endDate = data.endDate?.trim();
  if (!startDate || !endDate) {
    const d = defaultExhibitionDates();
    startDate = startDate || d.startDate;
    endDate = endDate || d.endDate;
  }

  validateDate(startDate, 'startDate');
  validateDate(endDate, 'endDate');

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    throw new ApiError(
      400,
      'End date must be after start date',
      'VALIDATION_ERROR',
      { field: 'endDate' }
    );
  }

  const galleryUrls = normalizeGalleryUrlsForWrite(data);
  if (!galleryUrls[0]) {
    throw new ApiError(
      400,
      'At least one image URL is required',
      'VALIDATION_ERROR',
      { field: 'imageUrl' }
    );
  }

  const allowFlag = data.allowUserImages === true;

  const baseInsert: Record<string, unknown> = {
    title: data.title.trim(),
    description: data.description.trim(),
    gallery: data.gallery.trim(),
    start_date: startDate,
    end_date: endDate,
    image_url: galleryUrls[0],
    location: data.location?.trim() || null,
    user_id: data.userId,
    is_public: data.isPublic !== undefined ? data.isPublic : true,
  };

  const attempts: Record<string, unknown>[] = [
    { ...baseInsert, gallery_image_urls: galleryUrls, allow_user_images: allowFlag },
    { ...baseInsert, gallery_image_urls: galleryUrls },
    { ...baseInsert, allow_user_images: allowFlag },
    { ...baseInsert },
  ];

  let lastError: unknown;
  for (const row of attempts) {
    const { data: created, error } = await supabase
      .from('exhibitions')
      .insert(row)
      .select()
      .single();

    if (!error && created) {
      return mapExhibitionRow(created as Record<string, any>);
    }
    lastError = error;
  }

  const msg =
    lastError && typeof lastError === 'object' && 'message' in lastError
      ? String((lastError as { message: string }).message)
      : 'Failed to create exhibition';

  throw new ApiError(500, msg, 'INTERNAL_ERROR', { supabase: lastError });
};

/**
 * Update an existing exhibition
 */
export const updateExhibition = async (
  id: string,
  data: UpdateExhibitionData
): Promise<Exhibition> => {
  // Validate date formats if provided
  if (data.startDate) {
    validateDate(data.startDate, 'startDate');
  }
  if (data.endDate) {
    validateDate(data.endDate, 'endDate');
  }

  // Get existing exhibition
  const { data: existing, error: fetchError } = await supabase
    .from('exhibitions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new ApiError(404, 'Exhibition not found', 'NOT_FOUND');
  }

  // Prepare update data
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description.trim();
  if (data.gallery !== undefined) updateData.gallery = data.gallery.trim();
  if (data.startDate !== undefined) updateData.start_date = data.startDate;
  if (data.endDate !== undefined) updateData.end_date = data.endDate;
  if (data.location !== undefined) updateData.location = data.location.trim();
  if (data.isPublic !== undefined) updateData.is_public = data.isPublic;
  if (data.allowUserImages !== undefined) {
    updateData.allow_user_images = data.allowUserImages;
  }

  if (data.imageUrls !== undefined && data.imageUrls.length > 0) {
    const primaryFallback =
      typeof existing.image_url === 'string' ? existing.image_url.trim() : '';
    const primary =
      data.imageUrl !== undefined ? data.imageUrl.trim() : primaryFallback;
    const merged = normalizeGalleryUrlsForWrite({
      imageUrl: primary || String(data.imageUrls[0]).trim(),
      imageUrls: data.imageUrls,
    });
    updateData.image_url = merged[0];
    updateData.gallery_image_urls = merged;
  } else if (data.imageUrl !== undefined) {
    const u = data.imageUrl.trim();
    updateData.image_url = u;
    updateData.gallery_image_urls = [u];
  }

  // Validate date range if both dates are present
  const finalStartDate = updateData.start_date || existing.start_date;
  const finalEndDate = updateData.end_date || existing.end_date;
  const startDate = new Date(finalStartDate);
  const endDate = new Date(finalEndDate);

  if (endDate < startDate) {
    throw new ApiError(
      400,
      'End date must be after start date',
      'VALIDATION_ERROR',
      { field: 'endDate' }
    );
  }

  // Update exhibition
  const { data: updated, error: updateError } = await supabase
    .from('exhibitions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError || !updated) {
    throw new ApiError(500, 'Failed to update exhibition', 'INTERNAL_ERROR');
  }

  return mapExhibitionRow(updated as Record<string, any>);
};

/**
 * Delete an exhibition
 */
export const deleteExhibition = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('exhibitions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new ApiError(404, 'Exhibition not found', 'NOT_FOUND');
  }
};

/**
 * Add a photo from another user (only when exhibition.allow_user_images is true).
 */
export const addUserContributionImage = async (
  exhibitionId: string,
  userId: string,
  imageUrl: string
): Promise<void> => {
  const trimmed = String(imageUrl || '').trim();
  validateRequired(trimmed, 'imageUrl');

  const { data: row, error: fetchErr } = await supabase
    .from('exhibitions')
    .select('id, allow_user_images')
    .eq('id', exhibitionId)
    .single();

  if (fetchErr || !row) {
    throw new ApiError(404, 'Exhibition not found', 'NOT_FOUND');
  }

  if (!row.allow_user_images) {
    throw new ApiError(
      403,
      'Владелец не разрешил добавлять фотографии к этой выставке',
      'CONTRIBUTIONS_DISABLED'
    );
  }

  const { error } = await supabase.from('exhibition_user_images').insert({
    exhibition_id: exhibitionId,
    user_id: userId,
    image_url: trimmed,
  });

  if (error) {
    throw new ApiError(
      500,
      error.message || 'Не удалось добавить изображение',
      'INTERNAL_ERROR',
      { supabase: error }
    );
  }
};
