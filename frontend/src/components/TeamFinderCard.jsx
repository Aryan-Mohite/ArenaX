function TeamFinderCard({ player }) {
  return (
    <div className="bg-[#1e293b] p-4 rounded-lg">

      <h3 className="font-semibold">{player.name}</h3>

      <p className="text-sm text-gray-400">
        Rank: {player.rank}
      </p>

      <p className="text-sm text-gray-400">
        Game: {player.game}
      </p>

      <button className="mt-2 bg-purple-500 px-3 py-1 rounded">
        Invite
      </button>

    </div>
  );
}

export default TeamFinderCard;