import express from "express";
import { getUserProfile } from "../controllers/userController.js";

const router = express.Router();

router.get("/:id", getUserProfile);

export default router;