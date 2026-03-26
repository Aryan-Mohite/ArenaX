import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import tournamentRoutes from "./routes/tournamentRoutes.js";
import teamFinderRoutes from "./routes/teamFinderRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(errorHandler);

app.use("/api/auth", authRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/teamfinder", teamFinderRoutes);
app.use("/api/users", userRoutes);

export default app;