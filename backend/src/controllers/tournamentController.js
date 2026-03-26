import { tournaments } from "../data/db.js";
import { v4 as uuidv4 } from "uuid";

export const getTournaments = (req, res) => {
  res.json(tournaments);
};

export const createTournament = (req, res) => {
  const { name, region, prize } = req.body;

  const newTournament = {
    id: uuidv4(),
    name,
    region,
    prize,
  };

  tournaments.push(newTournament);

  res.status(201).json(newTournament);
};