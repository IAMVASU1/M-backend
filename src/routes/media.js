import { Router } from "express";
import { z } from "zod";

export const mediaRouter = Router();

mediaRouter.post("/media", async (req, res, next) => {
  try {
    const body = z.object({
      storage_path: z.string().min(1),
      album_id: z.string().uuid().nullable().optional(),
      caption: z.string().max(500).nullable().optional(),
      mime_type: z.string().nullable().optional(),
      size_bytes: z.number().int().nonnegative().nullable().optional(),
      width: z.number().int().positive().nullable().optional(),
      height: z.number().int().positive().nullable().optional()
    }).parse(req.body);

    const payload = {
      owner_id: req.uid,
      album_id: body.album_id ?? null,
      storage_path: body.storage_path,
      caption: body.caption ?? null,
      mime_type: body.mime_type ?? null,
      size_bytes: body.size_bytes ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
    };

    const { data, error } = await req.sb
      .from("media")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json({ media: data });
  } catch (e) {
    next(e);
  }
});