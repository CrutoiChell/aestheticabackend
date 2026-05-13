import { Router, Request, Response } from 'express';
import * as artworkService from '../services/artworkService';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/artworks
 * Get all artworks with optional filter by exhibition
 * Query params: exhibitionId
 * Response: { success: true, data: { artworks: Artwork[] } }
 */
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { exhibitionId } = req.query;

  const artworks = await artworkService.getAllArtworks({
    exhibitionId: exhibitionId as string | undefined,
  });

  res.status(200).json({
    success: true,
    data: { artworks },
  });
}));

/**
 * GET /api/artworks/:id
 * Get a single artwork by ID
 * Response: { success: true, data: { artwork: Artwork } }
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const artwork = await artworkService.getArtworkById(id);

  res.status(200).json({
    success: true,
    data: { artwork },
  });
}));

/**
 * POST /api/artworks
 * Create a new artwork (authenticated users - must own the exhibition)
 * Headers: { Authorization: "Bearer <token>" }
 * Body: { title, artist, year, description, imageUrl, exhibitionId, dimensions?, medium? }
 * Response: { success: true, data: { artwork: Artwork } }
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const artworkData = {
      ...req.body,
      userId: req.user!.userId,
    };
    const artwork = await artworkService.createArtwork(artworkData, req.user!.userId, req.user!.role);

    res.status(201).json({
      success: true,
      data: { artwork },
    });
  })
);

/**
 * PUT /api/artworks/:id
 * Update an existing artwork (owner or admin)
 * Headers: { Authorization: "Bearer <token>" }
 * Body: Partial<Artwork>
 * Response: { success: true, data: { artwork: Artwork } }
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const updateData = req.body;
    const artwork = await artworkService.updateArtwork(id, updateData, req.user!.userId, req.user!.role);

    res.status(200).json({
      success: true,
      data: { artwork },
    });
  })
);

/**
 * DELETE /api/artworks/:id
 * Delete an artwork (owner or admin)
 * Headers: { Authorization: "Bearer <token>" }
 * Response: { success: true, data: { message: string } }
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    await artworkService.deleteArtwork(id, req.user!.userId, req.user!.role);

    res.status(200).json({
      success: true,
      data: { message: 'Artwork deleted successfully' },
    });
  })
);

export default router;
