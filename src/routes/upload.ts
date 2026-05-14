import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { supabase } from '../storage/supabaseClient';
import multer from 'multer';
import path from 'path';

const router = Router();

const STORAGE_BUCKET = 'images';

// Use memory storage everywhere - files go to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены (jpeg, jpg, png, gif, webp)'));
    }
  }
});

/**
 * POST /api/upload
 * Upload an image file to Supabase Storage
 * Headers: { Authorization: "Bearer <token>" }
 * Body: multipart/form-data with 'image' field
 * Response: { success: true, data: { url: string } }
 */
router.post(
  '/',
  authenticate,
  upload.single('image'),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Файл не загружен',
          code: 'NO_FILE',
        },
      });
      return;
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(req.file.originalname);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload] Supabase storage error:', uploadError);
      res.status(500).json({
        success: false,
        error: {
          message: `Ошибка загрузки: ${uploadError.message}`,
          code: 'UPLOAD_ERROR',
        },
      });
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename);

    res.status(200).json({
      success: true,
      data: {
        url: urlData.publicUrl,
        filename,
      },
    });
  })
);

export default router;
