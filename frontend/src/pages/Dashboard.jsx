function Dashboard(){

return(

<div>

<h1 className="text-3xl font-bold mb-6">
Dashboard
</h1>

<div className="grid grid-cols-3 gap-6">

<div className="bg-[#1e293b] p-6 rounded">
Active Players
<h2 className="text-2xl mt-2">12K</h2>
</div>

<div className="bg-[#1e293b] p-6 rounded">
Live Streams
<h2 className="text-2xl mt-2">340</h2>
</div>

<div className="bg-[#1e293b] p-6 rounded">
Upcoming Tournaments
<h2 className="text-2xl mt-2">18</h2>
</div>

</div>

</div>

)

}

export default Dashboard