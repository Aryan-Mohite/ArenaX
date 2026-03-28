function GameCard({ game }) {
  return (
    <div className="bg-[#1e293b] rounded-lg p-4 hover:scale-105 transition">

      <img src={game.image} className="rounded" />

      <h3 className="mt-3 font-semibold">{game.name}</h3>

      <p className="text-sm text-gray-400">{game.genre}</p>

    </div>
  );
}

export default GameCard;