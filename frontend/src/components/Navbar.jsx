
import { Link } from "react-router-dom";

function Navbar(){

  const nav={
    display:"flex",
    justifyContent:"space-between",
    padding:"15px 40px",
    background:"#020617",
    borderBottom:"1px solid #1e293b"
  }

  const links={
    display:"flex",
    gap:"20px"
  }

  const link={
    color:"white",
    textDecoration:"none",
    fontWeight:"bold"
  }

  return(
    <div style={nav}>
      <h2>eSports Hub</h2>

      <div style={links}>
        <Link style={link} to="/">Home</Link>
        <Link style={link} to="/games">Games</Link>
        <Link style={link} to="/tournament">Tournaments</Link>
        <Link style={link} to="/teamfinder">Team Finder</Link>
        <Link style={link} to="/stream">Stream</Link>
        <Link style={link} to="/communities">Communities</Link>
        <Link style={link} to="/profile">Profile</Link>
      </div>
    </div>
  )
}

export default Navbar
