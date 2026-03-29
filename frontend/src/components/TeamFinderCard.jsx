
import "../styles/cards.css"
function TeamFinderCard({player,rank,game}){
return(
<div className="team-card">
<h3>{player}</h3>
<p>Game: {game}</p>
<p>Rank: {rank}</p>
<button>Invite</button>
</div>
)}
export default TeamFinderCard
