function TournamentCard({ tournament }) {
  return (
    <div className="bg-[#1e293b] p-5 rounded-lg">

      <h3 className="font-semibold mb-2">
        {tournament.name}
      </h3>

      <p>Prize Pool: {tournament.prize}</p>

      <p className="text-gray-400 text-sm">
        Starts: {tournament.date}
      </p>

      <button className="mt-3 bg-purple-600 px-4 py-2 rounded">
        Join
      </button>

    </div>
  );
}

export default TournamentCard;