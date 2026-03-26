import { teamPosts } from "../data/db.js";
import { v4 as uuidv4 } from "uuid";

export const createPost = (req, res) => {
  const { game, rank, role, region, description } = req.body;

  const post = {
    id: uuidv4(),
    game,
    rank,
    role,
    region,
    description,
  };

  teamPosts.push(post);

  res.status(201).json(post);
};

export const getPosts = (req, res) => {
  res.json(teamPosts);
};