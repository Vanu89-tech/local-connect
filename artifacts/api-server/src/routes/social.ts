import { Router, type IRouter, type Request, type Response } from "express";

import {
  comments,
  currentUser,
  findPost,
  findUser,
  makeId,
  parties,
  posts,
  type Comment,
  type Party,
  type PartyMember,
  type Post,
  users,
} from "../data/store";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ message });
}

function getString(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getNumber(body: unknown, key: string): number | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function getPartyMembers(body: unknown): PartyMember[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)["members"];
  if (!Array.isArray(value)) return undefined;

  const members: PartyMember[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const id = getString(item, "id");
    const name = getString(item, "name");
    const lat = getNumber(item, "lat");
    const lng = getNumber(item, "lng");
    if (!id || !name || lat === undefined || lng === undefined) return undefined;
    members.push({ id, name, lat, lng });
  }
  return members;
}

router.get("/me", requireAuth, (req, res) => {
  res.json(req.currentUser);
});

router.get("/users", (_req, res) => {
  res.json(users);
});

router.get("/users/:id", (req, res) => {
  const user = findUser(getParam(req, "id"));
  if (!user) {
    sendError(res, 404, "User not found");
    return;
  }
  res.json(user);
});

router.get("/posts", (_req, res) => {
  res.json(posts);
});

router.post("/posts", requireAuth, (req: Request, res: Response) => {
  const content = getString(req.body, "content");
  const location = getString(req.body, "location");
  const imageUrl = getString(req.body, "imageUrl");
  const actor = req.currentUser ?? currentUser;

  if (!content || !location) {
    sendError(res, 400, "content and location are required");
    return;
  }

  const post: Post = {
    id: makeId("post"),
    userId: actor.id,
    user: actor,
    content,
    imageUrl,
    location,
    likesCount: 0,
    commentsCount: 0,
    liked: false,
    createdAt: new Date().toISOString(),
  };

  posts.unshift(post);
  res.status(201).json(post);
});

router.get("/posts/:id", (req, res) => {
  const post = findPost(getParam(req, "id"));
  if (!post) {
    sendError(res, 404, "Post not found");
    return;
  }
  res.json(post);
});

router.post("/posts/:id/like", requireAuth, (req, res) => {
  const post = findPost(getParam(req, "id"));
  if (!post) {
    sendError(res, 404, "Post not found");
    return;
  }

  post.liked = !post.liked;
  post.likesCount += post.liked ? 1 : -1;
  res.json(post);
});

router.get("/posts/:id/comments", (req, res) => {
  const post = findPost(getParam(req, "id"));
  if (!post) {
    sendError(res, 404, "Post not found");
    return;
  }
  res.json(comments.filter((comment) => comment.postId === post.id));
});

router.post("/posts/:id/comments", requireAuth, (req, res) => {
  const post = findPost(getParam(req, "id"));
  const actor = req.currentUser ?? currentUser;
  if (!post) {
    sendError(res, 404, "Post not found");
    return;
  }

  const content = getString(req.body, "content");
  if (!content) {
    sendError(res, 400, "content is required");
    return;
  }

  const comment: Comment = {
    id: makeId("comment"),
    postId: post.id,
    userId: actor.id,
    user: actor,
    content,
    createdAt: new Date().toISOString(),
  };

  comments.push(comment);
  post.commentsCount += 1;
  res.status(201).json(comment);
});

router.get("/parties", (_req, res) => {
  res.json(parties);
});

router.post("/parties", requireAuth, (req, res) => {
  const name = getString(req.body, "name");
  const lat = getNumber(req.body, "lat");
  const lng = getNumber(req.body, "lng");
  const members = getPartyMembers(req.body);
  const actor = req.currentUser ?? currentUser;

  if (!name || lat === undefined || lng === undefined || !members) {
    sendError(res, 400, "name, lat, lng, and members are required");
    return;
  }

  const party: Party = {
    id: makeId("party"),
    name,
    lat,
    lng,
    hostId: actor.id,
    hostName: actor.name,
    members,
    createdAt: new Date().toISOString(),
  };

  parties.push(party);
  res.status(201).json(party);
});

export default router;
