
import express from "express";
import {
  createTournament,
  getTournaments,
} from "../controllers/tournamentController.js";
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/create", authMiddleware, createTournament);
router.post("/join", authMiddleware, joinTournament);



export default router;