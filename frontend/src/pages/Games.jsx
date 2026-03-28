import GameCard from "../components/GameCard";

function Games(){

const games=[
{ id:1,name:"Valorant",genre:"FPS",image:"/games/valorant.jpg"},
{ id:2,name:"CS2",genre:"FPS",image:"/games/cs2.jpg"}
]

return(

<div>

<h1 className="text-2xl mb-6">
Games
</h1>

<div className="grid grid-cols-4 gap-6">

{games.map(g=>(
<GameCard key={g.id} game={g}/>
))}

</div>

</div>

)

}

export default Games