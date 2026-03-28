function StreamCard({ stream }) {
  return (
    <div className="bg-[#1e293b] rounded-lg overflow-hidden">

      <img src={stream.thumbnail} />

      <div className="p-4">

        <h3 className="font-semibold">{stream.title}</h3>

        <p className="text-sm text-gray-400">{stream.streamer}</p>

        <p className="text-red-500 text-xs">
          ● LIVE {stream.viewers}
        </p>

      </div>

    </div>
  );
}

export default StreamCard;