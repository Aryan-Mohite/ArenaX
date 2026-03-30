const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create", authMiddleware, createTeam);
router.post("/join", authMiddleware, joinTeam);

module.exports = router;