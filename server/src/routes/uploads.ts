import express from "express";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";
import sharp from "sharp";
import { putObject } from "../storage/s3";
import { insertFile } from "../db/scylla";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const uploadsRouter = express.Router();

uploadsRouter.post(
	"/",
	upload.single("file"),
	(req: Request, res: Response, next: NextFunction): void => {
		const file = req.file;
		if (!file) {
			res.status(400).json({ error: "file is required" });
			return;
		}
		const bucket = process.env.S3_BUCKET as string;
		if (!bucket) {
			res.status(500).json({ error: "S3_BUCKET not configured" });
			return;
		}

		const fileId = uuidv4();
		const ext = mime.extension(file.mimetype || "") || "bin";
		const key = `uploads/${fileId}.${ext}`;

		const isImage = (file.mimetype || "").startsWith("image/");
		const generateThumb = isImage;

		Promise.resolve()
			.then(async () => {
				await putObject({ bucket, key, body: file.buffer, contentType: file.mimetype || undefined });
				let thumbKey: string | null = null;
				let width: number | null = null;
				let height: number | null = null;
				if (generateThumb) {
					const image = sharp(file.buffer);
					const metadata = await image.metadata();
					if (metadata.width && metadata.height) {
						width = metadata.width;
						height = metadata.height;
					}
					const thumb = await image.resize({ width: 320, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
					thumbKey = `thumbnails/${fileId}.jpg`;
					await putObject({ bucket, key: thumbKey, body: thumb, contentType: "image/jpeg" });
				}
				await insertFile({
					file_id: fileId,
					s3_key: key,
					mime: file.mimetype || null,
					size: file.size ?? null,
					width,
					height,
					thumbnail_key: thumbKey,
					created_at: new Date(),
				});
				res.status(201).json({ fileId, key, thumbnailKey: thumbKey });
			})
			.catch(next);
	}
); 