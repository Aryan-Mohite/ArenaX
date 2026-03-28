import { Link } from "react-router-dom";

function Navbar() {
  return (
    <div className="bg-[#1e293b] flex justify-between items-center px-6 py-4 border-b border-gray-700">

      <input
        placeholder="Search games, streams..."
        className="bg-[#0f172a] px-3 py-2 rounded w-72"
      />

      <div className="flex items-center gap-4">

        <button className="hover:text-purple-400">
          🔔
        </button>

        <Link to="/profile">
          <img
            src="https://i.pravatar.cc/40"
            className="rounded-full w-9 h-9"
          />
        </Link>

      </div>

    </div>
  );
}

export default Navbar;