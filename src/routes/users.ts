import { Router, Response, Request } from 'express';
import * as userService from '../services/userService';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { supabase } from '../storage/supabaseClient';

const router = Router();

/** Map DB row → API shape (public-safe: no email/password) */
function mapPublicUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url || null,
    bio: row.bio || null,
    role: row.role,
    createdAt: row.created_at,
  };
}

function mapExhibitionRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    gallery: row.gallery,
    startDate: row.start_date,
    endDate: row.end_date,
    imageUrl: row.image_url,
    imageUrls: Array.isArray(row.gallery_image_urls) && row.gallery_image_urls.length
      ? row.gallery_image_urls
      : [row.image_url].filter(Boolean),
    location: row.location,
    artworkIds: [],
    userId: row.user_id,
    isPublic: row.is_public,
    allowUserImages: Boolean(row.allow_user_images),
    likesCount: row.likes_count || 0,
    commentsCount: row.comments_count || 0,
    artworksCount: row.artworks_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** GET /api/users/profile — current user */
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    const user = await userService.getUserProfile(req.user.userId);
    res.status(200).json({ success: true, data: { user } });
  })
);

/** PUT /api/users/profile — update current user */
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    const user = await userService.updateUserProfile(req.user.userId, req.body);
    res.status(200).json({ success: true, data: { user } });
  })
);

/** GET /api/users/my-exhibitions — exhibitions created by current user */
router.get(
  '/my-exhibitions',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');

    const { data, error } = await supabase
      .from('exhibitions')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });

    if (error) throw new ApiError(500, 'Failed to fetch exhibitions', 'INTERNAL_ERROR');
    res.status(200).json({ success: true, data: { exhibitions: (data || []).map(mapExhibitionRow) } });
  })
);

/** GET /api/users/liked-exhibitions — exhibitions liked by current user */
router.get(
  '/liked-exhibitions',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');

    const { data, error } = await supabase
      .from('likes')
      .select('exhibition_id, exhibitions(*)')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });

    if (error) throw new ApiError(500, 'Failed to fetch liked exhibitions', 'INTERNAL_ERROR');

    const exhibitions = (data || [])
      .map((row: any) => row.exhibitions)
      .filter(Boolean)
      .map(mapExhibitionRow);

    res.status(200).json({ success: true, data: { exhibitions } });
  })
);

/**
 * GET /api/users/:id
 * Public user profile by id (no email exposed). Also returns their public exhibitions.
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, name, avatar_url, bio, role, created_at')
      .eq('id', id)
      .single();

    if (userErr || !userRow) throw new ApiError(404, 'User not found', 'NOT_FOUND');

    const { data: exData, error: exErr } = await supabase
      .from('exhibitions')
      .select('*')
      .eq('user_id', id)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    res.status(200).json({
      success: true,
      data: {
        user: mapPublicUser(userRow),
        exhibitions: exErr ? [] : (exData || []).map(mapExhibitionRow),
      },
    });
  })
);

// ── Admin routes ──

router.get(
  '/admin/all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    if (req.user.role !== 'admin') throw new ApiError(403, 'Admin only', 'FORBIDDEN');

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw new ApiError(500, 'Failed to fetch users', 'INTERNAL_ERROR');

    res.status(200).json({
      success: true,
      data: {
        users: (data || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.created_at,
        })),
      },
    });
  })
);

router.put(
  '/admin/:id/role',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    if (req.user.role !== 'admin') throw new ApiError(403, 'Admin only', 'FORBIDDEN');

    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      throw new ApiError(400, 'Invalid role', 'VALIDATION_ERROR');
    }

    const { error } = await supabase.from('users').update({ role }).eq('id', id);
    if (error) throw new ApiError(500, 'Failed to update role', 'INTERNAL_ERROR');

    res.status(200).json({ success: true, data: { message: 'Role updated' } });
  })
);

router.delete(
  '/admin/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    if (req.user.role !== 'admin') throw new ApiError(403, 'Admin only', 'FORBIDDEN');
    if (req.user.userId === req.params.id) throw new ApiError(400, 'Cannot delete yourself', 'VALIDATION_ERROR');

    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) throw new ApiError(500, 'Failed to delete user', 'INTERNAL_ERROR');

    res.status(200).json({ success: true, data: { message: 'User deleted' } });
  })
);

export default router;
