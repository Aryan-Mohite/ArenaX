
import "../styles/cards.css"
function GameCard({name,image}){
return(
<div className="game-card">
<img src={image}/>
<h3 className="game-title">{name}</h3>
</div>
)}
export default GameCard
