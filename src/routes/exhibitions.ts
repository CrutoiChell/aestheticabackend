import { Router, Request, Response } from 'express';
import * as exhibitionService from '../services/exhibitionService';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { supabase } from '../storage/supabaseClient';

const router = Router();

/**
 * GET /api/exhibitions
 * Get all exhibitions with optional search and filter parameters
 * Query params: search, gallery, startDate, endDate, limit, offset (limit+offset = pagination; omit for full list)
 * Response: { success: true, data: { exhibitions: Exhibition[], total: number } }
 */
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { search, gallery, startDate, endDate, limit, offset } = req.query;

  const list = await exhibitionService.getAllExhibitions({
    search: search as string | undefined,
    gallery: gallery as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
    limit: limit !== undefined ? Number(limit) : undefined,
    offset: offset !== undefined ? Number(offset) : undefined,
  });

  res.status(200).json({
    success: true,
    data: list,
  });
}));

/**
 * GET /api/exhibitions/:id
 * Get a single exhibition by ID with its artworks
 * Response: { success: true, data: { exhibition: Exhibition, artworks: Artwork[] } }
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const exhibition = await exhibitionService.getExhibitionById(id);

  // Fetch artworks for this exhibition
  const { data: artworksData, error: artworksError } = await supabase
    .from('artworks')
    .select('*')
    .eq('exhibition_id', id)
    .order('created_at', { ascending: true });

  const artworks = artworksError ? [] : (artworksData || []).map((item: any) => ({
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

  res.status(200).json({
    success: true,
    data: { exhibition, artworks },
  });
}));

/**
 * POST /api/exhibitions
 * Create a new exhibition (authenticated users)
 * Headers: { Authorization: "Bearer <token>" }
 * Body: { title, description, gallery, startDate, endDate, imageUrl, location?, isPublic? }
 * Response: { success: true, data: { exhibition: Exhibition } }
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const exhibitionData = {
      ...req.body,
      userId: req.user!.userId,
    };
    const exhibition = await exhibitionService.createExhibition(exhibitionData);

    res.status(201).json({
      success: true,
      data: { exhibition },
    });
  })
);

/**
 * PUT /api/exhibitions/:id
 * Update an existing exhibition (owner or admin)
 * Headers: { Authorization: "Bearer <token>" }
 * Body: Partial<Exhibition>
 * Response: { success: true, data: { exhibition: Exhibition } }
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Check if user is owner or admin
    const existing = await exhibitionService.getExhibitionById(id);
    if (existing.userId !== userId && userRole !== 'admin') {
      throw new ApiError(403, 'Нет прав на редактирование этой выставки', 'FORBIDDEN');
    }

    const updateData = req.body;
    const exhibition = await exhibitionService.updateExhibition(id, updateData);

    res.status(200).json({
      success: true,
      data: { exhibition },
    });
  })
);

/**
 * DELETE /api/exhibitions/:id
 * Delete an exhibition (owner or admin)
 * Headers: { Authorization: "Bearer <token>" }
 * Response: { success: true, data: { message: string } }
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Check if user is owner or admin
    const existing = await exhibitionService.getExhibitionById(id);
    if (existing.userId !== userId && userRole !== 'admin') {
      throw new ApiError(403, 'Нет прав на удаление этой выставки', 'FORBIDDEN');
    }

    await exhibitionService.deleteExhibition(id);

    res.status(200).json({
      success: true,
      data: { message: 'Exhibition deleted successfully' },
    });
  })
);

/**
 * POST /api/exhibitions/:id/user-images
 * Add photo from any authenticated user if the owner enabled allow_user_images.
 */
router.post(
  '/:id/user-images',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { imageUrl } = req.body as { imageUrl?: string };

    if (!imageUrl || String(imageUrl).trim() === '') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Поле imageUrl обязательно',
          code: 'VALIDATION_ERROR',
        },
      });
      return;
    }

    await exhibitionService.addUserContributionImage(id, req.user!.userId, imageUrl);

    res.status(201).json({
      success: true,
      data: { message: 'Изображение добавлено' },
    });
  })
);

/**
 * POST /api/exhibitions/:id/like
 * Toggle like on an exhibition (authenticated users)
 * Headers: { Authorization: "Bearer <token>" }
 * Response: { success: true, data: { liked: boolean, likesCount: number } }
 */
router.post(
  '/:id/like',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if like exists
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('exhibition_id', id)
      .single();

    if (existingLike) {
      // Unlike
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('exhibition_id', id);

      // Get updated count
      const { data: exhibition } = await supabase
        .from('exhibitions')
        .select('likes_count')
        .eq('id', id)
        .single();

      res.status(200).json({
        success: true,
        data: {
          liked: false,
          likesCount: exhibition?.likes_count || 0,
        },
      });
    } else {
      // Like
      await supabase
        .from('likes')
        .insert({
          user_id: userId,
          exhibition_id: id,
        });

      // Get updated count
      const { data: exhibition } = await supabase
        .from('exhibitions')
        .select('likes_count')
        .eq('id', id)
        .single();

      res.status(200).json({
        success: true,
        data: {
          liked: true,
          likesCount: exhibition?.likes_count || 0,
        },
      });
    }
  })
);

/**
 * GET /api/exhibitions/:id/like-status
 * Get like status for current user
 * Headers: { Authorization: "Bearer <token>" }
 * Response: { success: true, data: { liked: boolean, likesCount: number } }
 */
router.get(
  '/:id/like-status',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    const { data: like } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('exhibition_id', id)
      .single();

    const { data: exhibition } = await supabase
      .from('exhibitions')
      .select('likes_count')
      .eq('id', id)
      .single();

    res.status(200).json({
      success: true,
      data: {
        liked: !!like,
        likesCount: exhibition?.likes_count || 0,
      },
    });
  })
);

/**
 * POST /api/exhibitions/:id/comments
 * Create a comment on an exhibition
 * Headers: { Authorization: "Bearer <token>" }
 * Body: { content: string }
 * Response: { success: true, data: { comment: Comment } }
 */
router.post(
  '/:id/comments',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!.userId;

    if (!content || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Содержание комментария обязательно',
          code: 'VALIDATION_ERROR',
        },
      });
      return;
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        user_id: userId,
        exhibition_id: id,
        content: content.trim(),
      })
      .select('*, users(name)')
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: {
        comment: {
          id: comment.id,
          userId: comment.user_id,
          exhibitionId: comment.exhibition_id,
          content: comment.content,
          userName: comment.users?.name,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
        },
      },
    });
  })
);

/**
 * GET /api/exhibitions/:id/comments
 * Get all comments for an exhibition
 * Response: { success: true, data: { comments: Comment[] } }
 */
router.get(
  '/:id/comments',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const { data: comments, error } = await supabase
      .from('comments')
      .select('*, users(name)')
      .eq('exhibition_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        comments: comments.map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          exhibitionId: c.exhibition_id,
          content: c.content,
          userName: c.users?.name,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
      },
    });
  })
);

/**
 * DELETE /api/comments/:id
 * Delete own comment
 * Headers: { Authorization: "Bearer <token>" }
 * Response: { success: true, data: { message: string } }
 */
router.delete(
  '/comments/:commentId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { commentId } = req.params;
    const userId = req.user!.userId;

    // Check if comment belongs to user
    const { data: comment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (!comment) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Комментарий не найден',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    if (comment.user_id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          message: 'Нет прав на удаление этого комментария',
          code: 'FORBIDDEN',
        },
      });
      return;
    }

    await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    res.status(200).json({
      success: true,
      data: { message: 'Комментарий удален' },
    });
  })
);

export default router;
