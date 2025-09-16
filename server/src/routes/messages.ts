import express from "express";
import type { Request, Response, NextFunction } from "express";
import { insertMessage, listMessages, getUserByServerId } from "../db/scylla";

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
		const { senderServerId, text, attachments } = (req.body || {}) as {
			senderServerId?: string;
			text?: string;
			attachments?: string[];
		};
		if (!senderServerId) {
			res.status(400).json({ error: "senderServerId is required" });
			return;
		}
		Promise.resolve()
			.then(async () => {
				// Get user info for the sender
				const user = await getUserByServerId(senderServerId);
				if (!user) {
					throw new Error("User not registered. Please register first.");
				}
				
				return insertMessage({
					conversation_id: conversationId,
					sender_server_id: senderServerId,
					text: text ?? null,
					attachments: attachments ?? null,
					reactions: null,
				});
			})
			.then((created) => res.status(201).json(created))
			.catch(next);
	}
);