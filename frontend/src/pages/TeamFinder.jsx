
import TeamFinderCard from "../components/TeamFinderCard"

function TeamFinder(){

  const container={ padding:"40px" }

  return(
    <div style={container}>
      <h1>Find Teammates</h1>

      <TeamFinderCard
        player="ShadowX"
        game="Valorant"
        rank="Diamond"
      />

      <TeamFinderCard
        player="SniperPro"
        game="CS2"
        rank="Global Elite"
      />
    </div>
  )
}

export default TeamFinder
