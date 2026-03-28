import TournamentCard from "../components/TournamentCard";

function Tournaments(){

const data=[
{ id:1,name:"Valorant Cup",prize:"$10,000",date:"12 Aug"}
]

return(

<div>

<h1 className="text-2xl mb-6">
Tournaments
</h1>

<div className="grid grid-cols-2 gap-6">

{data.map(t=>(
<TournamentCard key={t.id} tournament={t}/>
))}

</div>

</div>

)

}

export default Tournaments