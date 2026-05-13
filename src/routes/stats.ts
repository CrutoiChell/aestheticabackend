import { Router, Request, Response } from 'express';
import { supabase } from '../storage/supabaseClient';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/stats
 * Get platform statistics
 * Response: { success: true, data: { users, exhibitions, artworks, favorites } }
 */
router.get('/', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  // Get counts from database
  const [usersResult, exhibitionsResult, artworksResult] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('exhibitions').select('id', { count: 'exact', head: true }),
    supabase.from('artworks').select('id', { count: 'exact', head: true }),
  ]);

  const stats = {
    users: usersResult.count || 0,
    exhibitions: exhibitionsResult.count || 0,
    artworks: artworksResult.count || 0,
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
}));

export default router;
