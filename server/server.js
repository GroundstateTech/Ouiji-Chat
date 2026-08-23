const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const PORT = Number(process.env.PORT || 8080);
const DATA = path.join(__dirname, "data");
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, {recursive:true});
const fp = n => path.join(DATA,n);
const read = (n,f) => { try { return fs.existsSync(fp(n)) ? JSON.parse(fs.readFileSync(fp(n),"utf8")) : f; } catch { return f; } };
const save = (n,d) => fs.writeFileSync(fp(n), JSON.stringify(d,null,2), "utf8");

function seed(){
  if(!fs.existsSync(fp("departments.json"))) save("departments.json", [
    {id:"admin",name:"Administration"},{id:"it",name:"IT"},{id:"eng",name:"Engineering"},{id:"ops",name:"Operations"},{id:"research",name:"Research"}
  ]);
  if(!fs.existsSync(fp("projects.json"))) save("projects.json", [
    {id:"blackglass",name:"BlackGlass"},{id:"caregrid",name:"CareGrid"},{id:"staffroot",name:"StaffRoot"},{id:"iupetra",name:"IuPetra"},{id:"thothscript",name:"ThothScript"}
  ]);
  if(!fs.existsSync(fp("users.json"))) save("users.json", [
    {username:"michael",password:"password",displayName:"Michael Muha",departmentId:"admin",role:"Director",email:"michael@groundstate.local",extension:"101",location:"HQ",status:"Offline",statusMessage:"Building Groundstate"},
    {username:"sarah",password:"password",displayName:"Sarah",departmentId:"admin",role:"Coordinator",email:"sarah@groundstate.local",extension:"102",location:"HQ",status:"Offline",statusMessage:""},
    {username:"kevin",password:"password",displayName:"Kevin",departmentId:"it",role:"Technician",email:"kevin@groundstate.local",extension:"201",location:"Server Room",status:"Offline",statusMessage:""},
    {username:"lisa",password:"password",displayName:"Lisa",departmentId:"eng",role:"Engineer",email:"lisa@groundstate.local",extension:"301",location:"Lab",status:"Offline",statusMessage:""},
    {username:"steve",password:"password",displayName:"Steve",departmentId:"ops",role:"Operator",email:"steve@groundstate.local",extension:"401",location:"Floor",status:"Offline",statusMessage:""},
    {username:"amanda",password:"password",displayName:"Amanda",departmentId:"research",role:"Researcher",email:"amanda@groundstate.local",extension:"501",location:"Research",status:"Offline",statusMessage:""}
  ]);
  if(!fs.existsSync(fp("messages.json"))) save("messages.json", []);
  if(!fs.existsSync(fp("roomMessages.json"))) save("roomMessages.json", []);
}
seed();

let users=read("users.json",[]), departments=read("departments.json",[]), projects=read("projects.json",[]), messages=read("messages.json",[]), roomMessages=read("roomMessages.json",[]);
const sockets = new Map(), socketsByUser = new Map();
function pub(u){ const d=departments.find(x=>x.id===u.departmentId); return {username:u.username,displayName:u.displayName,departmentId:u.departmentId,department:d?d.name:"",role:u.role,email:u.email,extension:u.extension,location:u.location,status:u.status,statusMessage:u.statusMessage}; }
function directory(){ users=read("users.json",[]); return {departments, users: users.map(pub), projects}; }
function send(ws,p){ if(ws.readyState===ws.OPEN) ws.send(JSON.stringify(p)); }
function broadcast(p){ const s=JSON.stringify(p); for(const c of wss.clients) if(c.readyState===c.OPEN)c.send(s); }
function attach(ws, username){
  sockets.set(ws, username);
  if(!socketsByUser.has(username)) socketsByUser.set(username,new Set());
  const set=socketsByUser.get(username), first=set.size===0; set.add(ws);
  const u=users.find(x=>x.username===username); if(u){u.status="Online";save("users.json",users);}
  if(first){broadcast({type:"buddyOnline", username}); broadcast({type:"directory", ...directory()});}
}
function detach(ws){
  const username=sockets.get(ws); if(!username)return;
  sockets.delete(ws); const set=socketsByUser.get(username); if(!set)return;
  set.delete(ws);
  if(set.size===0){ socketsByUser.delete(username); const u=users.find(x=>x.username===username); if(u){u.status="Offline";save("users.json",users);} broadcast({type:"buddyOffline",username}); broadcast({type:"directory",...directory()});}
}
const wss = new WebSocketServer({port:PORT, path:"/ws"});
console.log(`Ouiji server running on ws://localhost:${PORT}/ws`);

wss.on("connection", ws=>{
  send(ws,{type:"hello"});
  ws.on("message", raw=>{
    let msg; try{msg=JSON.parse(raw.toString())}catch{return}
    if(msg.type==="login"){
      const username=String(msg.username||"").trim().toLowerCase(), password=String(msg.password||"");
      const u=users.find(x=>x.username.toLowerCase()===username && x.password===password);
      if(!u)return send(ws,{type:"auth",success:false,message:"Invalid username or password"});
      attach(ws,u.username); return send(ws,{type:"auth",success:true,username:u.username,user:pub(u),...directory()});
    }
    if(msg.type==="registerClient"){ const username=String(msg.username||"").trim().toLowerCase(); const u=users.find(x=>x.username.toLowerCase()===username); if(u)attach(ws,u.username); return; }
    if(msg.type==="getDirectory") return send(ws,{type:"directory",...directory()});
    if(msg.type==="setStatus"){ const username=sockets.get(ws); const u=users.find(x=>x.username===username); if(u){u.status=msg.status||"Online";u.statusMessage=msg.statusMessage||"";save("users.json",users);broadcast({type:"directory",...directory()});} return; }
    if(msg.type==="getEmployeeCard"){ const t=String(msg.username||"").trim().toLowerCase(); const u=users.find(x=>x.username.toLowerCase()===t); return send(ws,{type:"employeeCard",user:u?pub(u):null}); }
    if(msg.type==="getConversation"){ const a=String(msg.username||"").trim().toLowerCase(), b=String(msg.buddy||"").trim().toLowerCase(); const h=messages.filter(m=>(m.from.toLowerCase()===a&&m.to.toLowerCase()===b)||(m.from.toLowerCase()===b&&m.to.toLowerCase()===a)); return send(ws,{type:"conversationHistory",messages:h}); }
    if(msg.type==="dmSend"){ const from=sockets.get(ws), to=String(msg.to||"").trim().toLowerCase(), text=String(msg.text||"").slice(0,4000); if(!from||!to||!text)return; const r=users.find(x=>x.username.toLowerCase()===to); if(!r)return; const dm={from,to:r.username,text,timestamp:new Date().toISOString()}; messages.push(dm); save("messages.json",messages); const payload={type:"message",...dm}; for(const name of [from,r.username]){const set=socketsByUser.get(name); if(set)for(const sock of set)send(sock,payload);} return; }
    if(msg.type==="joinRoom"){ const room=String(msg.room||""); return send(ws,{type:"roomHistory",room,messages:roomMessages.filter(m=>m.room===room)}); }
    if(msg.type==="roomSend"){ const from=sockets.get(ws), room=String(msg.room||""), text=String(msg.text||"").slice(0,4000); if(!from||!room||!text)return; const rm={room,from,text,timestamp:new Date().toISOString()}; roomMessages.push(rm); save("roomMessages.json",roomMessages); broadcast({type:"roomMessage",...rm}); return; }
  });
  ws.on("close",()=>detach(ws));
});
