
import "../styles/cards.css"
function TournamentCard({title,game,prize}){
return(
<div className="tournament-card">
<h3>{title}</h3>
<p>Game: {game}</p>
<p>Prize Pool: {prize}</p>
<button>Join Tournament</button>
</div>
)}
export default TournamentCard
