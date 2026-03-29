
import GameCard from "../components/GameCard"
function Games(){
return(
<div className="container">
<h1>Popular Games</h1>
<div className="grid">
<GameCard name="Valorant" image="https://images.unsplash.com/photo-1605902711622-cfb43c4437d1"/>
<GameCard name="CS2" image="https://images.unsplash.com/photo-1542751371-adc38448a05e"/>
</div>
</div>
)}
export default Games
