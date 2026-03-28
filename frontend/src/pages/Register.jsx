import { useState } from "react";
import api from "../services/api";

function Register(){

  const [username,setUsername]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");

  const handleRegister = async()=>{

    try{

      await api.post("/auth/register",{
        username,
        email,
        password
      });

      alert("Registration successful");

    }
    catch(err){
      console.log(err);
    }

  }

  return(

    <div className="flex justify-center mt-20">

      <div className="w-80">

        <h2 className="text-2xl mb-4">Register</h2>

        <input
          placeholder="Username"
          className="border p-2 w-full mb-3"
          onChange={(e)=>setUsername(e.target.value)}
        />

        <input
          placeholder="Email"
          className="border p-2 w-full mb-3"
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="border p-2 w-full mb-3"
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          onClick={handleRegister}
          className="bg-green-500 text-white p-2 w-full"
        >
          Register
        </button>

      </div>

    </div>

  )
}

export default Register