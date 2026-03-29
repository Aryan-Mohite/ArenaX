
import TournamentCard from "../components/TournamentCard"

function Tournament(){

  const container={ padding:"40px" }

  return(
    <div style={container}>
      <h1>Upcoming Tournaments</h1>

      <TournamentCard
        title="Valorant Open Cup"
        game="Valorant"
        prize="$5000"
      />

      <TournamentCard
        title="CS2 Pro League"
        game="CS2"
        prize="$8000"
      />
    </div>
  )
}

export default Tournament
