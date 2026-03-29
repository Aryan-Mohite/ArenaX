
function GameCard({name,image}){

  const card={
    width:"220px",
    background:"#0f172a",
    borderRadius:"12px",
    padding:"15px",
    textAlign:"center",
    boxShadow:"0 0 15px rgba(56,189,248,0.4)"
  }

  const img={
    width:"100%",
    borderRadius:"10px"
  }

  const title={
    marginTop:"10px",
    color:"#38bdf8"
  }

  return(
    <div style={card}>
      <img src={image} style={img}/>
      <h3 style={title}>{name}</h3>
    </div>
  )
}

export default GameCard
