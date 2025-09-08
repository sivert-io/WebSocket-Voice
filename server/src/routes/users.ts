import express from "express";
import type { Request, Response, NextFunction } from "express";
import { upsertUser, getUserByServerId } from "../db/scylla";

export const usersRouter = express.Router();

usersRouter.post(
  "/register",
  (req: Request, res: Response, next: NextFunction): void => {
    const { userId, nickname } = (req.body || {}) as {
      userId?: string;
      nickname?: string;
    };
    
    if (!userId || !nickname) {
      res.status(400).json({ error: "userId and nickname are required" });
      return;
    }
    
    if (typeof nickname !== 'string' || nickname.length > 50) {
      res.status(400).json({ error: "nickname must be a string with max 50 characters" });
      return;
    }
    
    Promise.resolve()
      .then(() => upsertUser(userId, nickname.trim()))
      .then((user) => {
        // Only return public information
        const publicUserInfo = {
          serverUserId: user.server_user_id,
          nickname: user.nickname
        };
        res.status(201).json(publicUserInfo);
      })
      .catch(next);
  }
);

usersRouter.get(
  "/:serverUserId",
  (req: Request, res: Response, next: NextFunction): void => {
    const { serverUserId } = req.params as { serverUserId: string };
    
    Promise.resolve()
      .then(() => getUserByServerId(serverUserId))
      .then((user) => {
        if (!user) {
          res.status(404).json({ error: "User not found" });
          return;
        }
        // Only return public information
        const publicUserInfo = {
          serverUserId: user.server_user_id,
          nickname: user.nickname
        };
        res.json(publicUserInfo);
      })
      .catch(next);
  }
);
