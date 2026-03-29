
import GameCard from "../components/GameCard"

function Games(){

  const container={ padding:"40px" }

  const grid={
    display:"flex",
    gap:"30px",
    flexWrap:"wrap"
  }

  return(
    <div style={container}>
      <h1>Popular Games</h1>

      <div style={grid}>
        <GameCard
          name="Valorant"
          image="https://images.unsplash.com/photo-1605902711622-cfb43c4437d1"
        />

        <GameCard
          name="CS2"
          image="https://images.unsplash.com/photo-1542751371-adc38448a05e"
        />
      </div>
    </div>
  )
}

export default Games
