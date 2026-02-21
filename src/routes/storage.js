import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { config } from "../lib/config.js";

export const storageRouter = Router();

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

storageRouter.post("/storage/signed-upload", async (req, res, next) => {
  try {
    const body = z.object({
      album_id: z.string().uuid().nullable().optional(),
      filename: z.string().min(1),
      contentType: z.string().min(3).optional()
    }).parse(req.body);

    const bucket = config.bucket;
    const folder = body.album_id ? body.album_id : "no-album";
    const rand = crypto.randomBytes(6).toString("hex");
    const file = `${Date.now()}_${rand}_${safeFilename(body.filename)}`;

    // Path convention: userId/albumId(or no-album)/filename
    const path = `${req.uid}/${folder}/${file}`;

    // createSignedUploadUrl => returns { signedUrl, token, path }
    const { data, error } = await req.sb
      .storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) throw error;

    res.json({
      bucket,
      storage_path: path,
      token: data.token,
      signedUrl: data.signedUrl
    });
  } catch (e) {
    next(e);
  }
});
