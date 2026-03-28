import { useState } from "react";

function ChatBox() {

  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");

  const send=()=>{

    if(!input) return;

    setMessages([...messages,input]);
    setInput("");

  }

  return(

    <div className="bg-[#1e293b] p-4 rounded-lg">

      <div className="h-40 overflow-y-scroll mb-3">

        {messages.map((m,i)=>(
          <p key={i}>{m}</p>
        ))}

      </div>

      <div className="flex gap-2">

        <input
        value={input}
        onChange={(e)=>setInput(e.target.value)}
        className="flex-1 bg-[#0f172a] p-2 rounded"
        />

        <button
        onClick={send}
        className="bg-purple-600 px-3 rounded"
        >
        Send
        </button>

      </div>

    </div>

  )

}

export default ChatBox