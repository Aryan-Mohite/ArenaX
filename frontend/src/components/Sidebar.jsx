import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <div className="w-64 bg-[#020617] p-6 border-r border-gray-800">

      <h1 className="text-2xl font-bold text-purple-500 mb-10">
        eSportsHub
      </h1>

      <ul className="space-y-5 text-gray-300">

        <li><Link to="/dashboard">Dashboard</Link></li>

        <li><Link to="/games">Games</Link></li>

        <li><Link to="/streams">Streams</Link></li>

        <li><Link to="/tournaments">Tournaments</Link></li>

        <li><Link to="/communities">Communities</Link></li>

        <li><Link to="/teamfinder">Team Finder</Link></li>

        <li><Link to="/profile">Profile</Link></li>

      </ul>

    </div>
  );
}

export default Sidebar;