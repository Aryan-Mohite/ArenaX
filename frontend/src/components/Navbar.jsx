import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "../styles/navbar.css";

function Navbar() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dropdown, setDropdown] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="logo">
        <Link to="/">eSports Hub</Link>
      </div>

      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/games">Games</Link>
        <Link to="/tournament">Tournaments</Link>
        <Link to="/teamfinder">Team Finder</Link>
        <Link to="/stream">Stream</Link>
        <Link to="/communities">Communities</Link>
      </div>

      <div className="nav-auth">
        {!isLoggedIn && (
          <>
            <Link className="login-btn" to="/login">
              Login
            </Link>
            <Link className="register-btn" to="/register">
              Register
            </Link>
          </>
        )}

        {isLoggedIn && (
          <div className="profile-section">
            <img
              src="/default-avatar.jpeg"
              alt="profile"
              className="avatar"
              onClick={() => setDropdown(!dropdown)}
            />

            {dropdown && (
              <div className="dropdown">
                <Link to="/profile">My Profile</Link>
                <Link to="/settings">Settings</Link>
                <button onClick={logout}>Logout</button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
