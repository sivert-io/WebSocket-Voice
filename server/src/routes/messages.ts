import express from "express";
import type { Request, Response, NextFunction } from "express";
import { insertMessage, listMessages } from "../db/scylla";

export const messagesRouter = express.Router();

messagesRouter.get(
	"/:conversationId",
	(req: Request, res: Response, next: NextFunction): void => {
		const { conversationId } = req.params as { conversationId: string };
		const limit = req.query.limit ? Number(req.query.limit) : 50;
		const before = req.query.before ? new Date(String(req.query.before)) : undefined;
		Promise.resolve()
			.then(() => listMessages(conversationId, limit, before))
			.then((messages) => res.json({ items: messages }))
			.catch(next);
	}
);

messagesRouter.post(
	"/:conversationId",
	(req: Request, res: Response, next: NextFunction): void => {
		const { conversationId } = req.params as { conversationId: string };
		const { senderId, text, attachments } = (req.body || {}) as {
			senderId?: string;
			text?: string;
			attachments?: string[];
		};
		if (!senderId) {
			res.status(400).json({ error: "senderId is required" });
			return;
		}
		Promise.resolve()
			.then(() =>
				insertMessage({
					conversation_id: conversationId,
					sender_id: senderId,
					text: text ?? null,
					attachments: attachments ?? null,
				})
			)
			.then((created) => res.status(201).json(created))
			.catch(next);
	}
); 