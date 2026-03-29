
function TeamFinderCard({player,rank,game}){

  const card={
    background:"#0f172a",
    padding:"20px",
    borderRadius:"10px",
    marginBottom:"15px",
    boxShadow:"0 0 10px rgba(34,197,94,0.4)"
  }

  return(
    <div style={card}>
      <h3>{player}</h3>
      <p>Game: {game}</p>
      <p>Rank: {rank}</p>
      <button>Invite</button>
    </div>
  )
}

export default TeamFinderCard
