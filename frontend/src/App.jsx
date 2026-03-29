
import { BrowserRouter, Routes, Route } from "react-router-dom"
import Navbar from "./components/Navbar"

import Home from "./pages/Home"
import Games from "./pages/Games"
import Tournament from "./pages/Tournament"
import TeamFinder from "./pages/TeamFinder"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Profile from "./pages/Profile"
import Stream from "./pages/Stream"
import Communities from "./pages/Communities"

function App(){
return(
<BrowserRouter>
<Navbar/>
<Routes>
<Route path="/" element={<Home/>}/>
<Route path="/games" element={<Games/>}/>
<Route path="/tournament" element={<Tournament/>}/>
<Route path="/teamfinder" element={<TeamFinder/>}/>
<Route path="/login" element={<Login/>}/>
<Route path="/register" element={<Register/>}/>
<Route path="/profile" element={<Profile/>}/>
<Route path="/stream" element={<Stream/>}/>
<Route path="/communities" element={<Communities/>}/>
</Routes>
</BrowserRouter>
)}
export default App
