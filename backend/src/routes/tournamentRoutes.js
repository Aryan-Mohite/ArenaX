import express from "express";
import {
  getTournaments,
  createTournament,
} from "../controllers/tournamentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getTournaments);
router.post("/", createTournament);
router.post("/", protect, createTournament);

export default router;