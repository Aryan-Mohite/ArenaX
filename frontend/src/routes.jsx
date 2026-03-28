import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import Streams from "./pages/Streams";
import Tournaments from "./pages/Tournaments";
import Communities from "./pages/Communities";
import TeamFinder from "./pages/TeamFinder";
import Profile from "./pages/Profile";

function RoutesConfig() {
  return (
    <Routes>

      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/games" element={<Games />} />

      <Route path="/streams" element={<Streams />} />

      <Route path="/tournaments" element={<Tournaments />} />

      <Route path="/communities" element={<Communities />} />

      <Route path="/teamfinder" element={<TeamFinder />} />

      <Route path="/profile" element={<Profile />} />

    </Routes>
  );
}

export default RoutesConfig;