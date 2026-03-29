
function Home(){

  const container={
    padding:"60px",
    textAlign:"center"
  }

  const title={
    fontSize:"48px",
    color:"#38bdf8",
    textShadow:"0 0 20px #38bdf8"
  }

  return(
    <div style={container}>
      <h1 style={title}>eSports Hub</h1>
      <p>Join tournaments, find teammates and stream games</p>
    </div>
  )
}

export default Home
