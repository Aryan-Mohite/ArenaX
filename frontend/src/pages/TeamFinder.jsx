import TeamFinderCard from "../components/TeamFinderCard";

function TeamFinder(){

const players=[
{ id:1,name:"Shadow",rank:"Diamond",game:"Valorant"}
]

return(

<div>

<h1 className="text-2xl mb-6">
Find Teammates
</h1>

<div className="grid grid-cols-3 gap-6">

{players.map(p=>(
<TeamFinderCard key={p.id} player={p}/>
))}

</div>

</div>

)

}

export default TeamFinder