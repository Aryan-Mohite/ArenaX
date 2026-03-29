
import { Link } from "react-router-dom"
import "../styles/navbar.css"

function Navbar(){
return(
<div className="navbar">
<h2>eSports Hub</h2>
<div className="nav-links">
<Link to="/">Home</Link>
<Link to="/games">Games</Link>
<Link to="/tournament">Tournaments</Link>
<Link to="/teamfinder">Team Finder</Link>
<Link to="/stream">Stream</Link>
<Link to="/communities">Communities</Link>
<Link to="/profile">Profile</Link>
</div>
</div>
)}
export default Navbar
