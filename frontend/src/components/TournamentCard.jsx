
function TournamentCard({title,game,prize}){

  const card={
    background:"#0f172a",
    padding:"20px",
    borderRadius:"12px",
    marginBottom:"20px",
    boxShadow:"0 0 10px rgba(168,85,247,0.4)"
  }

  const heading={
    color:"#a855f7"
  }

  return(
    <div style={card}>
      <h3 style={heading}>{title}</h3>
      <p>Game: {game}</p>
      <p>Prize Pool: {prize}</p>
      <button>Join Tournament</button>
    </div>
  )
}

export default TournamentCard
