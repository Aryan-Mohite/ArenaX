import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getPosts, createPost, applyToPost, closePost, draftAcceptApplication, finalAcceptApplication, rejectApplication } from "../services/teamFinderService";
import { getMyGames } from "../services/gameService";
import { ErrorMessage } from "../components/UI";
import { useAuth } from "../context/AuthContext";

const authFetch = async (url, opts = {}) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const res = await fetch(`/api${url}`, { ...opts, headers: { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}), ...opts.headers }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
};

const timeAgo = (d) => { const diff=Date.now()-new Date(d).getTime(),m=Math.floor(diff/60000); if(m<60)return m+"m ago"; const h=Math.floor(m/60); if(h<24)return h+"h ago"; return Math.floor(h/24)+"d ago"; };
const deadlineLabel = (deadline) => { if(!deadline)return null; const diff=new Date(deadline).getTime()-Date.now(); if(diff<=0)return{text:"Expired",color:"#ef4444"}; const h=Math.floor(diff/3600000); if(h<24)return{text:`${h}h left`,color:"#f59e0b"}; return{text:`${Math.floor(h/24)}d left`,color:"#10b981"}; };

const APP_STATUS = {
  pending:       {label:"⏳ Awaiting",  bg:"rgba(245,158,11,0.1)",  border:"rgba(245,158,11,0.3)",  color:"#f59e0b"},
  draft_accepted:{label:"💬 In Chat",   bg:"rgba(59,130,246,0.1)",  border:"rgba(59,130,246,0.3)",  color:"#60a5fa"},
  accepted:      {label:"✅ On Roster", bg:"rgba(16,185,129,0.1)",  border:"rgba(16,185,129,0.3)",  color:"#10b981"},
  rejected:      {label:"✕ Dismissed", bg:"rgba(255,70,85,0.1)",   border:"rgba(255,70,85,0.3)",   color:"#ff4655"},
};

function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle,rgba(255,70,85,0.12) 1px,transparent 1px)",backgroundSize:"36px 36px",maskImage:"radial-gradient(ellipse 80% 60% at 50% 0%,black 40%,transparent 100%)"}} />
      <div style={{position:"absolute",top:"-120px",left:"50%",transform:"translateX(-50%)",width:"700px",height:"300px",background:"radial-gradient(ellipse,rgba(255,70,85,0.18) 0%,transparent 70%)"}} />
    </div>
  );
}

function ChatModal({ partnerId, partnerName, onClose }) {
  const [messages,setMessages]=useState([]);const [text,setText]=useState("");const [loading,setLoading]=useState(true);const [sending,setSending]=useState(false);const {user}=useAuth();const bottomRef=useRef(null);const pollRef=useRef(null);
  const loadMessages=useCallback(async()=>{try{const r=await authFetch(`/messages/conversation/${partnerId}?limit=60`);setMessages(r.messages||[]);}catch{} finally{setLoading(false);}},[partnerId]);
  useEffect(()=>{loadMessages();pollRef.current=setInterval(loadMessages,4000);return()=>clearInterval(pollRef.current);},[loadMessages]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const handleSend=async()=>{if(!text.trim()||sending)return;setSending(true);const opt={message_id:Date.now(),sender_id:user?.id,receiver_id:partnerId,content:text.trim(),sent_at:new Date().toISOString(),_opt:true};setMessages(p=>[...p,opt]);setText("");try{await authFetch("/messages",{method:"POST",body:{receiver_id:partnerId,content:opt.content}});}catch{}setSending(false);};
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{backdropFilter:"blur(8px)",background:"rgba(2,6,23,0.82)"}}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-surface-border overflow-hidden flex flex-col animate-slide-up" style={{height:"min(90vh,580px)",background:"linear-gradient(145deg,#1a2340,#0f172a)",boxShadow:"0 0 0 1px rgba(59,130,246,0.2),0 24px 80px rgba(0,0,0,0.7)"}}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border shrink-0" style={{background:"linear-gradient(135deg,rgba(59,130,246,0.08),transparent)"}}>
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">{partnerName?.[0]?.toUpperCase()}</div>
          <div className="flex-1 min-w-0"><p className="font-semibold text-white text-sm">{partnerName}</p><p className="text-xs text-blue-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"/>Squad Comms</p></div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {loading?<div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-surface-border border-t-blue-400 rounded-full animate-spin"/></div>:messages.length===0?<div className="flex flex-col items-center justify-center flex-1 text-center"><div className="text-4xl mb-2 opacity-20">💬</div><p className="text-gray-500 text-sm">Start the conversation!</p></div>:messages.map(msg=>{const isMine=msg.sender_id===user?.id;return(<div key={msg.message_id} className={`flex ${isMine?"justify-end":"justify-start"}`}><div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMine?"rounded-br-sm bg-blue-500/20 border border-blue-500/20 text-white":"rounded-bl-sm bg-white/5 border border-white/10 text-gray-200"} ${msg._opt?"opacity-60":""}`}><p>{msg.content}</p><p className={`text-xs mt-0.5 ${isMine?"text-blue-400/60":"text-gray-600"}`}>{new Date(msg.sent_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</p></div></div>);})}
          <div ref={bottomRef}/>
        </div>
        <div className="px-3 py-3 border-t border-surface-border shrink-0 flex gap-2 items-end">
          <textarea className="flex-1 resize-none rounded-xl border border-surface-border bg-white/5 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors" rows={1} placeholder="Type a message..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}} style={{minHeight:"38px",maxHeight:"96px"}}/>
          <button onClick={handleSend} disabled={!text.trim()||sending} className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all shrink-0 disabled:opacity-30" style={{background:"linear-gradient(135deg,#3b82f6,#2563eb)"}}>➤</button>
        </div>
      </div>
    </div>
  );
}

function RosterModal({ post, onClose, onChat, navigate }) {
  const [apps,setApps]=useState([]);const [loading,setLoading]=useState(true);const [actioning,setActioning]=useState(null);const [toast,setToast]=useState("");
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),2500);};
  useEffect(()=>{authFetch(`/teamfinder/${post.post_id}/applications`).then(r=>setApps(r.applications||[])).catch(()=>setApps([])).finally(()=>setLoading(false));},[post.post_id]);
  const upd=(id,patch)=>setApps(p=>p.map(a=>a.application_id===id?{...a,...patch}:a));
  const doAction=async(app,action,newStatus,msg)=>{setActioning(app.application_id+"_"+action);try{await authFetch(`/teamfinder/${post.post_id}/applications/${app.application_id}/${action}`,{method:"PATCH"});upd(app.application_id,{status:newStatus});if(msg)showToast(msg);}catch{showToast("Failed");}setActioning(null);};
  const groups={draft_accepted:apps.filter(a=>a.status==="draft_accepted"),pending:apps.filter(a=>a.status==="pending"),accepted:apps.filter(a=>a.status==="accepted"),rejected:apps.filter(a=>a.status==="rejected")};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backdropFilter:"blur(8px)",background:"rgba(2,6,23,0.82)"}}>
      <div className="w-full max-w-lg rounded-2xl border border-surface-border overflow-hidden animate-slide-up flex flex-col relative" style={{background:"linear-gradient(145deg,#1a2340,#131a2e)",boxShadow:"0 0 0 1px rgba(255,70,85,0.15),0 24px 80px rgba(0,0,0,0.7)",maxHeight:"90vh"}}>
        {toast&&<div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-surface-card border border-green-500/30 text-green-400 text-xs px-4 py-2 rounded-full whitespace-nowrap">{toast}</div>}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0" style={{background:"linear-gradient(135deg,rgba(255,70,85,0.08),transparent)"}}>
          <div><h3 className="font-display font-bold text-white text-lg">Applicants — {post.game_name}</h3><p className="text-xs text-gray-500 mt-0.5">{post.team_name?`Team: ${post.team_name}`:"No team assigned"} · {post.role_required||"Any Role"}</p></div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading?<div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-surface-border border-t-red rounded-full animate-spin"/></div>:apps.length===0?<div className="flex flex-col items-center justify-center py-16 text-center"><div className="text-5xl mb-3 opacity-20">📭</div><p className="text-gray-400 font-medium">No applicants yet</p><p className="text-gray-600 text-sm mt-1">Share your listing to attract players</p></div>:(
            <div>
              {[{key:"draft_accepted",title:"💬 In Chat",sub:"Chatting — finalize roster spot"},{key:"pending",title:"⏳ Awaiting Review",sub:null},{key:"accepted",title:"✅ On Roster",sub:null},{key:"rejected",title:"✕ Dismissed",sub:null}].map(({key,title,sub})=>groups[key].length===0?null:(
                <div key={key}>
                  <div className="px-6 py-2 border-b border-surface-border/50 bg-white/2"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title} <span className="text-gray-600 font-normal">({groups[key].length})</span></p>{sub&&<p className="text-xs text-gray-600 mt-0.5">{sub}</p>}</div>
                  {groups[key].map(app=>{
                    const cfg=APP_STATUS[app.status]||APP_STATUS.pending;
                    const busy=actioning?.startsWith(String(app.application_id));
                    return (
                      <div key={app.application_id} className="px-6 py-4 border-b border-surface-border/30 hover:bg-white/2 transition-colors">
                        <div className="flex items-start gap-3">
                          <button onClick={()=>navigate(`/users/${app.user_id}`)} className="w-10 h-10 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold text-sm shrink-0 hover:ring-2 hover:ring-red/40 hover:scale-105 transition-all overflow-hidden" title={`View ${app.username}'s profile`}>
                            {app.profile_picture?<img src={app.profile_picture} alt={app.username} className="w-full h-full object-cover"/>:app.username?.[0]?.toUpperCase()}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={()=>navigate(`/users/${app.user_id}`)} className="font-semibold text-white text-sm hover:text-red transition-colors">{app.username}</button>
                              {app.rank&&<span className="text-xs px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">{app.rank}</span>}
                              {app.game_role&&<span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light">{app.game_role}</span>}
                              {app.elo_rating&&<span className="text-xs px-2 py-0.5 rounded-full border border-surface-border bg-white/5 text-gray-400">ELO {app.elo_rating}</span>}
                            </div>
                            {app.message&&<p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{app.message}</p>}
                            <p className="text-xs text-gray-600 mt-1">{timeAgo(app.applied_at)}</p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full font-medium shrink-0" style={{background:cfg.bg,border:`1px solid ${cfg.border}`,color:cfg.color}}>{cfg.label}</span>
                        </div>
                        <div className="flex gap-2 mt-3" style={{paddingLeft:"52px"}}>
                          {app.status==="pending"&&<><button onClick={()=>doAction(app,"draft-accept","draft_accepted",`${app.username} moved to In Chat!`)} disabled={busy} className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">{actioning===app.application_id+"_draft-accept"?<span className="w-3 h-3 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin"/>:"💬 Draft Accept"}</button><button onClick={()=>doAction(app,"reject","rejected","")} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red/20 bg-red/5 text-red-light hover:bg-red/15 transition-colors disabled:opacity-50">✕</button></>}
                          {app.status==="draft_accepted"&&<><button onClick={()=>onChat(app.user_id,app.username)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1">💬 Open Chat</button><button onClick={()=>doAction(app,"final-accept","accepted",`🎉 ${app.username} is on the roster!`)} disabled={busy} className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">{actioning===app.application_id+"_final-accept"?<span className="w-3 h-3 border border-green-400/30 border-t-green-400 rounded-full animate-spin"/>:"✅ Add to Roster"}</button><button onClick={()=>doAction(app,"reject","rejected","")} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red/20 bg-red/5 text-red-light hover:bg-red/15 transition-colors disabled:opacity-50">✕</button></>}
                          {app.status==="accepted"&&<button onClick={()=>onChat(app.user_id,app.username)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">💬 Chat</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MyTeamsPanel({ myGames, onPostForTeam, refreshKey }) {
  const navigate=useNavigate();
  const [teams,setTeams]=useState([]);const [loading,setLoading]=useState(true);const [showCreate,setShowCreate]=useState(false);const [form,setForm]=useState({team_name:"",game_id:"",region:"",description:""});const [creating,setCreating]=useState(false);const [error,setError]=useState("");const [disbandTarget,setDisbandTarget]=useState(null);const [open,setOpen]=useState(true);
  const load=useCallback(()=>{authFetch("/teams/mine").then(r=>setTeams(r.teams||[])).catch(()=>setTeams([])).finally(()=>setLoading(false));},[]);
  useEffect(()=>{load();},[load,refreshKey]);
  const handleCreate=async(e)=>{e.preventDefault();setError("");setCreating(true);try{const r=await authFetch("/teams",{method:"POST",body:form});setTeams(p=>[r.team,...p]);setShowCreate(false);setForm({team_name:"",game_id:"",region:"",description:""});}catch(err){setError(err.message||"Failed to create team");}setCreating(false);};
  const handleDisband=async(id)=>{try{await authFetch(`/teams/${id}`,{method:"DELETE"});setTeams(p=>p.filter(t=>t.team_id!==id));setDisbandTarget(null);}catch{}};
  return (
    <div className="mb-8 rounded-2xl border border-surface-border overflow-hidden" style={{background:"linear-gradient(145deg,#1a2340,#131a2e)"}}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/2 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red/20 border border-red/30 flex items-center justify-center text-red text-sm">⚔️</div>
          <div className="text-left"><p className="font-semibold text-white text-sm">My Teams</p><p className="text-xs text-gray-500">{loading?"Loading...":`${teams.length} team${teams.length!==1?"s":""}`}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e=>{e.stopPropagation();setShowCreate(s=>!s);}} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red/30 bg-red/10 text-red hover:bg-red/20 transition-colors">{showCreate?"✕ Cancel":"+ New Team"}</button>
          <span className={`text-gray-500 transition-transform duration-200 ${open?"rotate-180":""}`}>▾</span>
        </div>
      </button>
      {showCreate&&(
        <div className="border-t border-surface-border px-6 py-4 animate-slide-up">
          {error&&<p className="text-red text-xs mb-3">⚠ {error}</p>}
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Team Name <span className="text-red">*</span></label><input className="input text-sm" placeholder="Shadow Wolves" required value={form.team_name} onChange={e=>setForm(f=>({...f,team_name:e.target.value}))}/></div>
            <div><label className="block text-xs text-gray-500 mb-1">Game <span className="text-red">*</span></label><select className="input text-sm" required value={form.game_id} onChange={e=>setForm(f=>({...f,game_id:e.target.value}))}><option value="">Select game</option>{myGames.map(g=><option key={g.game_id} value={g.game_id}>{g.game_name}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Region</label><input className="input text-sm" placeholder="South Asia, NA-East..." value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value}))}/></div>
            <div><label className="block text-xs text-gray-500 mb-1">Description</label><input className="input text-sm" placeholder="Competitive, casual..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
            <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={creating} className="btn-primary text-sm flex items-center gap-2">{creating?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:"⚔️"}{creating?"Assembling...":"Assemble Team"}</button></div>
          </form>
        </div>
      )}
      {open&&(
        <div className="border-t border-surface-border">
          {loading?<div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-surface-border border-t-red rounded-full animate-spin"/></div>:teams.length===0?<div className="flex flex-col items-center justify-center py-10 text-center"><div className="text-4xl mb-2 opacity-20">🛡️</div><p className="text-gray-400 text-sm font-medium">No teams yet</p><p className="text-gray-600 text-xs mt-1">Create your first team above to start recruiting</p></div>:(
            <div className="divide-y divide-surface-border">
              {teams.map(team=>(
                <div key={team.team_id} className="px-6 py-4">
                  {disbandTarget===team.team_id&&<div className="mb-3 rounded-xl border border-red/20 bg-red/5 p-3 flex items-center justify-between gap-3"><p className="text-xs text-gray-300">Disband <span className="text-white font-semibold">{team.team_name}</span>?</p><div className="flex gap-2 shrink-0"><button onClick={()=>setDisbandTarget(null)} className="px-2 py-1 text-xs rounded border border-surface-border text-gray-400">Cancel</button><button onClick={()=>handleDisband(team.team_id)} className="px-2 py-1 text-xs rounded border border-red/30 bg-red/10 text-red">Disband</button></div></div>}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white text-sm">{team.team_name}</p>
                        {team.game_name&&<span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light">🎮 {team.game_name}</span>}
                        {team.region&&<span className="text-xs text-gray-500">📍 {team.region}</span>}
                        <span className="text-xs px-2 py-0.5 rounded-full border border-surface-border bg-white/5 text-gray-400">{team.my_role==="captain"?"⭐ Captain":"Member"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {(team.members||[]).slice(0,8).map(m=>(
                          <button key={m.user_id} onClick={()=>navigate(`/users/${m.user_id}`)} title={m.username+(m.role==="captain"?" (Captain)":"")} className="relative hover:scale-110 transition-transform">
                            <div className="w-7 h-7 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-xs font-bold text-red overflow-hidden">
                              {m.profile_picture?<img src={m.profile_picture} alt={m.username} className="w-full h-full object-cover"/>:m.username?.[0]?.toUpperCase()}
                            </div>
                            {m.role==="captain"&&<span className="absolute -top-1 -right-1 text-[8px] leading-none">⭐</span>}
                          </button>
                        ))}
                        {(team.members||[]).length>8&&<span className="text-xs text-gray-500">+{team.members.length-8}</span>}
                        <span className="text-xs text-gray-600 ml-1">{(team.members||[]).length} member{(team.members||[]).length!==1?"s":""}</span>
                      </div>
                    </div>
                    {team.my_role==="captain"&&<div className="flex gap-1.5 shrink-0"><button onClick={()=>onPostForTeam(team)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors whitespace-nowrap">+ Draft</button><button onClick={()=>setDisbandTarget(team.team_id)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-red/20 bg-red/5 text-red-light hover:bg-red/15 transition-colors text-sm">🗑️</button></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MyDispatchesPanel({ onChat }) {
  const [apps,setApps]=useState([]);const [loading,setLoading]=useState(true);const [open,setOpen]=useState(true);
  const load=useCallback(async()=>{try{const r=await authFetch("/teamfinder/my-applications");setApps(r.applications||[]);}catch{setApps([]);}finally{setLoading(false);}}, []);
  useEffect(()=>{load();const id=setInterval(load,8000);return()=>clearInterval(id);},[load]);
  if(!loading&&apps.length===0)return null;
  return (
    <div className="mb-8 rounded-2xl border border-surface-border overflow-hidden" style={{background:"linear-gradient(145deg,#1a2340,#131a2e)"}}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/2 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm">📨</div>
          <div className="text-left"><p className="font-semibold text-white text-sm">My Dispatches</p><p className="text-xs text-gray-500">Track all your squad applications</p></div>
          {apps.some(a=>a.status==="draft_accepted"||a.status==="accepted")&&<span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 border border-blue-500/30 text-blue-400">{apps.filter(a=>a.status==="draft_accepted"||a.status==="accepted").length} Active</span>}
        </div>
        <span className={`text-gray-500 transition-transform duration-200 ${open?"rotate-180":""}`}>▾</span>
      </button>
      {open&&(
        <div className="border-t border-surface-border">
          {loading?<div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-surface-border border-t-blue-400 rounded-full animate-spin"/></div>:(
            <div className="divide-y divide-surface-border">
              {apps.map(app=>{const cfg=APP_STATUS[app.status]||APP_STATUS.pending;return(
                <div key={app.application_id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/2 transition-colors">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden" style={{background:"rgba(255,70,85,0.15)",border:"1px solid rgba(255,70,85,0.3)",color:"#ff4655"}}>
                    {app.poster_picture?<img src={app.poster_picture} alt="" className="w-full h-full object-cover"/>:app.poster_username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-white text-sm">{app.poster_username}</span><span className="text-xs text-gray-500">{app.game_name}</span>{app.team_name&&<span className="text-xs px-1.5 py-0.5 rounded border border-red/20 text-red-light">⚔️ {app.team_name}</span>}{app.role_required&&<span className="badge-red text-xs">{app.role_required}</span>}</div>
                    <p className="text-xs text-gray-600 mt-0.5">{timeAgo(app.applied_at)}</p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full shrink-0" style={{background:cfg.bg,border:`1px solid ${cfg.border}`,color:cfg.color}}>{cfg.label}</span>
                  {app.status==="draft_accepted"&&<button onClick={()=>onChat(app.poster_user_id,app.poster_username)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",color:"#60a5fa"}}>💬 Chat</button>}
                </div>
              );})}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApplyModal({ post, onClose, onSubmit }) {
  const [msg,setMsg]=useState("");const [loading,setLoading]=useState(false);
  const handle=async()=>{setLoading(true);await onSubmit(post.post_id,msg||"I'd like to join your team!");setLoading(false);onClose();};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backdropFilter:"blur(8px)",background:"rgba(2,6,23,0.75)"}}>
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-card animate-slide-up" style={{boxShadow:"0 0 0 1px rgba(255,70,85,0.15),0 24px 80px rgba(0,0,0,0.6)"}}>
        <div className="relative overflow-hidden rounded-t-2xl px-6 pt-6 pb-4" style={{background:"linear-gradient(135deg,rgba(255,70,85,0.12),transparent)"}}>
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold overflow-hidden">{post.profile_picture?<img src={post.profile_picture} alt="" className="w-full h-full object-cover"/>:post.username?.[0]?.toUpperCase()}</div>
            <div><p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Sending Request To</p><p className="font-display font-bold text-white text-lg">{post.username}</p></div>
          </div>
        </div>
        {post.team_name&&<div className="mx-6 mb-3 px-3 py-2 rounded-lg border border-red/20 bg-red/5 flex items-center gap-2"><span className="text-sm">⚔️</span><span className="text-xs text-gray-300">Recruiting for <span className="text-white font-semibold">{post.team_name}</span></span></div>}
        <div className="mx-6 mb-5 rounded-xl bg-navy/60 border border-surface-border px-4 py-3 flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold text-white">{post.game_name}</span>
          {post.role_required&&<span className="badge-red text-xs">{post.role_required}</span>}
          {post.rank_required&&<span className="badge-blue text-xs">{post.rank_required}</span>}
          {post.region&&<span className="badge-gray text-xs">{post.region}</span>}
        </div>
        <div className="px-6 pb-6">
          <label className="block text-sm text-gray-400 mb-2">Message <span className="text-gray-600">(optional)</span></label>
          <textarea className="input resize-none" rows={3} placeholder="Introduce yourself — role, rank, playstyle..." value={msg} onChange={e=>setMsg(e.target.value)}/>
          <div className="flex gap-3 mt-4">
            <button onClick={onClose} className="btn-secondary flex-1">Abort</button>
            <button onClick={handle} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">{loading?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<>⚡ Send Request</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseDraftModal({ post, onClose, onConfirm }) {
  const [loading,setLoading]=useState(false);
  const handle=async()=>{setLoading(true);await onConfirm(post.post_id);setLoading(false);onClose();};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backdropFilter:"blur(8px)",background:"rgba(2,6,23,0.82)"}}>
      <div className="w-full max-w-sm rounded-2xl border border-red/20 overflow-hidden animate-slide-up" style={{background:"linear-gradient(145deg,#1a2340,#131a2e)",boxShadow:"0 0 0 1px rgba(255,70,85,0.15),0 24px 80px rgba(0,0,0,0.7)"}}>
        <div className="px-6 pt-6 pb-4 text-center"><div className="w-14 h-14 rounded-2xl bg-red/10 border border-red/20 flex items-center justify-center text-3xl mx-auto mb-4">🗑️</div><h3 className="font-display font-bold text-white text-lg">Close Draft?</h3><p className="text-gray-400 text-sm mt-2 leading-relaxed">This will close your draft for <span className="text-white font-medium">{post.game_name}</span>. All pending applicants will be dismissed.</p></div>
        <div className="flex gap-3 px-6 pb-6"><button onClick={onClose} className="btn-secondary flex-1">Cancel</button><button onClick={handle} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red/30 bg-red/20 text-red-light hover:bg-red/30 transition-colors flex items-center justify-center gap-2">{loading?<span className="w-4 h-4 border-2 border-red/30 border-t-red rounded-full animate-spin"/>:"🗑️ Disband"}</button></div>
      </div>
    </div>
  );
}

function ListingCard({ post, onApply, alreadyApplied, isAuthenticated, currentUserId, onViewRoster, onClose, onViewProfile }) {
  const {username,game_name,rank_required,role_required,region,description,poster_rank,poster_elo,created_at,post_id,deadline,team_name,profile_picture}=post;
  const accentMap=["#ff4655","#3b82f6","#8b5cf6","#10b981","#f59e0b"];
  const accent=accentMap[(post_id||0)%accentMap.length];
  const isOwner=currentUserId&&post.user_id===currentUserId;
  const dl=deadlineLabel(deadline);
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-surface-border overflow-hidden transition-all duration-300 hover:border-red/40 hover:-translate-y-0.5" style={{background:"linear-gradient(145deg,#1a2340,#131a2e)"}}>
      <div className="h-0.5 w-full" style={{background:`linear-gradient(90deg,${accent},transparent)`}}/>
      <div className="px-4 pb-4 flex flex-col gap-3 flex-1">
        {team_name&&<div className="flex items-center gap-1.5 pt-1"><span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light font-medium">⚔️ {team_name}</span></div>}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={()=>onViewProfile(post.user_id)} className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all hover:scale-110 hover:ring-2 overflow-hidden" style={{background:accent+"22",border:"1px solid "+accent+"44",color:accent}}>
            {profile_picture?<img src={profile_picture} alt={username} className="w-full h-full object-cover"/>:username?.[0]?.toUpperCase()}
          </button>
          <div className="flex-1 min-w-0"><p className="font-semibold text-white text-sm truncate">{username}</p><p className="text-xs text-gray-500 truncate">{game_name}</p></div>
          <div className="flex items-center gap-1.5 shrink-0">
            {dl&&<span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{color:dl.color,background:dl.color+"18",border:`1px solid ${dl.color}33`}}>⏱ {dl.text}</span>}
            <span className="text-xs text-gray-600">{timeAgo(created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {role_required&&<span className="badge-red">{role_required}</span>}
          {rank_required&&<span className="badge-blue">{rank_required}</span>}
          {region&&<span className="badge-gray">📍 {region}</span>}
          {poster_elo&&<span className="badge-gray">ELO {poster_elo}</span>}
          {poster_rank&&<span className="badge-gray">🏅 {poster_rank}</span>}
        </div>
        {description&&<p className="text-sm text-gray-400 leading-relaxed line-clamp-2 flex-1">{description}</p>}
        {isOwner&&<div className="mt-auto flex gap-2"><button onClick={()=>onViewRoster(post)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">👥 Roster</button><button onClick={()=>onClose(post)} className="w-9 flex items-center justify-center py-2 rounded-lg border border-red/20 bg-red/5 text-red-light hover:bg-red/15 transition-colors text-sm">🗑️</button></div>}
        {isAuthenticated&&!isOwner&&(alreadyApplied?<div className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-400 text-sm font-medium">✓ Request Dispatched</div>:<button onClick={onApply} className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95" style={{background:`linear-gradient(135deg,${accent}22,${accent}10)`,border:`1px solid ${accent}33`,color:accent}}>⚡ Send Request</button>)}
        {!isAuthenticated&&<a href="/login" className="mt-auto text-center block w-full py-2.5 rounded-lg border border-surface-border text-gray-500 text-sm hover:border-red/30 hover:text-gray-300 transition-colors">Sign In to Apply</a>}
      </div>
    </div>
  );
}

export default function TeamFinder() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [posts,setPosts]=useState([]);const [myGames,setMyGames]=useState([]);const [loading,setLoading]=useState(true);const [showForm,setShowForm]=useState(false);const [prefilledTeam,setPrefilledTeam]=useState(null);const [filters,setFilters]=useState({game_id:"",region:""});const [error,setError]=useState("");const [toast,setToast]=useState({msg:"",type:"success"});const [applyPost,setApplyPost]=useState(null);const [appliedIds,setAppliedIds]=useState(new Set());const [rosterPost,setRosterPost]=useState(null);const [chatPartner,setChatPartner]=useState(null);const [closePost_,setClosePost]=useState(null);const [myTeams,setMyTeams]=useState([]);const [teamsRefresh,setTeamsRefresh]=useState(0);
  const [form,setForm]=useState({game_id:"",team_id:"",rank_required:"",role_required:"",region:"",description:"",deadline:""});
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast({msg:"",type:"success"}),3500);};
  const loadPosts=useCallback(async()=>{setLoading(true);try{const params={};if(filters.game_id)params.game_id=filters.game_id;if(filters.region)params.region=filters.region;const res=await getPosts(params);setPosts(res.data.posts||[]);}catch{setPosts([]);}finally{setLoading(false);}}, [filters]);
  useEffect(()=>{loadPosts();},[loadPosts]);
  useEffect(()=>{if(isAuthenticated){getMyGames().then(r=>setMyGames(r.data.games||[])).catch(()=>{});authFetch("/teams/mine").then(r=>setMyTeams(r.teams||[])).catch(()=>{});}},[isAuthenticated,teamsRefresh]);
  const teamsForGame=myTeams.filter(t=>!form.game_id||String(t.game_id)===String(form.game_id));
  const handlePostForTeam=(team)=>{setPrefilledTeam(team);setForm(f=>({...f,game_id:String(team.game_id||""),team_id:String(team.team_id)}));setShowForm(true);window.scrollTo({top:0,behavior:"smooth"});};
  const handleApply=async(postId,message)=>{try{await applyToPost(postId,{message});setAppliedIds(p=>new Set([...p,postId]));showToast("Request dispatched!");}catch(err){showToast(err.response?.data?.message||"Failed","error");}};
  const handleCreate=async(e)=>{e.preventDefault();setError("");try{const payload={...form};if(!payload.deadline)delete payload.deadline;if(!payload.team_id)delete payload.team_id;await createPost(payload);setShowForm(false);setPrefilledTeam(null);setForm({game_id:"",team_id:"",rank_required:"",role_required:"",region:"",description:"",deadline:""});showToast("Recruitment deployed!");loadPosts();setTeamsRefresh(r=>r+1);}catch(err){setError(err.response?.data?.message||"Failed");}};
  const handleClosePost=async(postId)=>{try{await closePost(postId);setPosts(p=>p.filter(x=>x.post_id!==postId));showToast("Recruitment closed");}catch{showToast("Failed","error");}};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {toast.msg&&<div className={"fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in border "+(toast.type==="error"?"bg-red/20 border-red/40 text-red-light":"bg-surface-card border-green-500/30 text-green-400")}>{toast.msg}</div>}
      {applyPost&&<ApplyModal post={applyPost} onClose={()=>setApplyPost(null)} onSubmit={handleApply}/>}
      {rosterPost&&<RosterModal post={rosterPost} onClose={()=>setRosterPost(null)} onChat={(uid,name)=>{setRosterPost(null);setChatPartner({userId:uid,username:name});}} navigate={navigate}/>}
      {chatPartner&&<ChatModal partnerId={chatPartner.userId} partnerName={chatPartner.username} onClose={()=>setChatPartner(null)}/>}
      {closePost_&&<CloseDraftModal post={closePost_} onClose={()=>setClosePost(null)} onConfirm={handleClosePost}/>}

      {/* Hero */}
      <div className="relative mb-10 rounded-2xl overflow-hidden border border-surface-border" style={{background:"linear-gradient(135deg,#0f172a 0%,#1a2340 50%,#130a1a 100%)"}}>
        <GridBackground/>
        <div className="relative z-10 px-8 py-12 sm:py-16 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-red/10 border border-red/20 rounded-full px-3 py-1 mb-4"><span className="live-dot"/><span className="text-xs text-red-light font-semibold tracking-wider uppercase">Mercenary Market</span></div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-white leading-tight">Build Your <span className="text-gradient">Dream Squad</span></h1>
            <p className="text-gray-400 mt-3 max-w-lg text-sm leading-relaxed">Create your team, open a recruitment draft, review applicants, chat privately, then lock your roster.</p>
            <div className="flex flex-wrap gap-3 mt-6">
              {isAuthenticated?<button onClick={()=>setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><span>⚔️</span> Draft a Listing</button>:<a href="/login" className="btn-primary">Sign In to Recruit</a>}
            </div>
          </div>
          <div className="flex sm:flex-col gap-3 shrink-0">{[["⚔️","Open Drafts"],["⚡","Squad Requests"],["🏆","Squads Assembled"]].map(([icon,label])=><div key={label} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5"><span className="text-xl">{icon}</span><span className="text-xs text-gray-400 whitespace-nowrap">{label}</span></div>)}</div>
        </div>
      </div>

      {/* Create form */}
      {showForm&&(
        <div className="mb-8 rounded-2xl border border-red/20 overflow-hidden animate-slide-up" style={{background:"linear-gradient(135deg,rgba(255,70,85,0.06),rgba(26,35,64,0.9))"}}>
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-surface-border">
            <div><h3 className="font-display font-bold text-xl text-white">Open a Draft</h3><p className="text-xs text-gray-500 mt-0.5">{prefilledTeam?`Recruiting for ⚔️ ${prefilledTeam.team_name}`:"Set your requirements and recruit your next squadmate"}</p></div>
            <button onClick={()=>{setShowForm(false);setPrefilledTeam(null);}} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
          </div>
          <div className="p-6">
            <ErrorMessage message={error}/>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div><label className="block text-sm text-gray-400 mb-1.5">Game <span className="text-red">*</span></label><select className="input" value={form.game_id} onChange={e=>setForm(f=>({...f,game_id:e.target.value,team_id:""}))} required><option value="">Select game</option>{myGames.map(g=><option key={g.game_id} value={g.game_id}>{g.game_name}</option>)}</select></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">Team <span className="text-gray-600">(optional)</span></label><select className="input" value={form.team_id} onChange={e=>setForm(f=>({...f,team_id:e.target.value}))}><option value="">No team — solo post</option>{teamsForGame.filter(t=>t.my_role==="captain").map(t=><option key={t.team_id} value={t.team_id}>⚔️ {t.team_name}</option>)}</select></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">Role Required</label><input className="input" placeholder="IGL, Support, Entry Fragger..." value={form.role_required} onChange={e=>setForm(f=>({...f,role_required:e.target.value}))}/></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">Rank Required</label><input className="input" placeholder="Diamond+, Plat-Gold..." value={form.rank_required} onChange={e=>setForm(f=>({...f,rank_required:e.target.value}))}/></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">Region</label><input className="input" placeholder="South Asia, NA-East..." value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value}))}/></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">Deadline <span className="text-gray-600">(optional)</span></label><input type="datetime-local" className="input" value={form.deadline} min={new Date().toISOString().slice(0,16)} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/><p className="text-xs text-gray-600 mt-1">Draft will show a countdown and auto-close at this time</p></div>
              <div className="sm:col-span-2"><label className="block text-sm text-gray-400 mb-1.5">Description</label><textarea className="input resize-none" rows={3} placeholder="Tell players about your team, requirements, schedule..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
              <div className="sm:col-span-2 flex justify-end gap-3"><button type="button" onClick={()=>{setShowForm(false);setPrefilledTeam(null);}} className="btn-secondary">Abort</button><button type="submit" className="btn-primary flex items-center gap-2"><span>🚀</span> Deploy Listing</button></div>
            </form>
          </div>
        </div>
      )}

      {isAuthenticated&&<MyTeamsPanel myGames={myGames} onPostForTeam={handlePostForTeam} refreshKey={teamsRefresh}/>}
      {isAuthenticated&&<MyDispatchesPanel onChat={(uid,name)=>setChatPartner({userId:uid,username:name})}/>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span><input className="input pl-9 w-52" placeholder="Filter by region..." value={filters.region} onChange={e=>setFilters(f=>({...f,region:e.target.value}))}/></div>
        {myGames.length>0&&<select className="input w-48" value={filters.game_id} onChange={e=>setFilters(f=>({...f,game_id:e.target.value}))}><option value="">All Games</option>{myGames.map(g=><option key={g.game_id} value={g.game_id}>{g.game_name}</option>)}</select>}
        {(filters.region||filters.game_id)&&<button onClick={()=>setFilters({game_id:"",region:""})} className="btn-ghost text-sm text-red-light">✕ Clear filters</button>}
      </div>

      <ErrorMessage message={error}/>

      {loading?<div className="min-h-[40vh] flex flex-col items-center justify-center gap-3"><div className="w-10 h-10 border-2 border-surface-border border-t-red rounded-full animate-spin"/><p className="text-gray-500 text-sm">Scouting for squads...</p></div>:posts.length===0?<div className="flex flex-col items-center justify-center py-24 text-center"><div className="text-6xl mb-4 opacity-20">🎯</div><p className="text-gray-300 font-medium text-xl font-display">No recruitments found</p><p className="text-gray-500 text-sm mt-2 max-w-xs">{filters.region||filters.game_id?"Try removing filters":"Be the first to open a recruitment draft"}</p>{isAuthenticated&&<button onClick={()=>setShowForm(true)} className="btn-primary mt-6">⚔️ Draft a Listing</button>}</div>:(
        <>
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-gray-500"><span className="text-white font-semibold">{posts.length}</span> recruitment{posts.length!==1?"s":""} open</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map(post=><ListingCard key={post.post_id} post={post} onApply={()=>setApplyPost(post)} alreadyApplied={appliedIds.has(post.post_id)} isAuthenticated={isAuthenticated} currentUserId={user?.id} onViewRoster={setRosterPost} onClose={setClosePost} onViewProfile={uid=>navigate(`/users/${uid}`)}/>)}
          </div>
        </>
      )}
    </div>
  );
}
