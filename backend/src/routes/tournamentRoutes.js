import express from "express";
import {
  createTournament,
  getTournaments,
} from "../controllers/tournamentController.js";

const router = express.Router();

router.post("/", createTournament);
router.get("/", getTournaments);

export default router;