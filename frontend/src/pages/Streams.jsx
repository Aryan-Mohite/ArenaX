import StreamCard from "../components/StreamCard";

function Streams(){

const streams=[
{ id:1,title:"Valorant Ranked",streamer:"ProGamer",viewers:1200,thumbnail:"/streams/s1.jpg"}
]

return(

<div>

<h1 className="text-2xl mb-6">
Live Streams
</h1>

<div className="grid grid-cols-3 gap-6">

{streams.map(s=>(
<StreamCard key={s.id} stream={s}/>
))}

</div>

</div>

)

}

export default Streams