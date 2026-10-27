const API = "https://animai-fullstack-v1.onrender.com";
const root = document.getElementById("app");

const state = {
  token: localStorage.getItem("animai_token") || "",
  user: JSON.parse(localStorage.getItem("animai_user") || "null"),
  projects: []
};

function esc(v=""){
  return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function save(){
  localStorage.setItem("animai_token",state.token);
  localStorage.setItem("animai_user",JSON.stringify(state.user));
}
function page(html){root.innerHTML=html;}
function toast(msg){alert(msg);}

function landing(){
  page(`<div class="shell">
    <nav class="nav">
      <div class="brand">Anim<span>AI</span></div>
      <div class="navlinks"><span>Story AI</span><span>Characters</span><span>Scenes</span><span>AI Director</span></div>
      <div><button class="btn secondary" onclick="login()">Login</button> <button class="btn primary" onclick="register()">Get Started</button></div>
    </nav>
    <section class="hero">
      <span class="eyebrow">AI DIRECTOR FOR YOUR STORY</span>
      <h1>Turn your story into an <span class="gradient">animated movie.</span></h1>
      <p>Tell AnimAI what you want. AI analyzes characters, scenes, emotions, motion, dialogue, voice, music and editing — then builds your animation plan.</p>
      <div class="hero-actions"><button class="btn primary" onclick="register()">Create your first animation</button><button class="btn secondary" onclick="login()">Open Studio</button></div>
    </section>
    <section class="features">
      <div class="card"><h3>🎬 Story Analysis</h3><p class="muted">Automatically understand characters, scenes, actions, emotions and dialogue.</p></div>
      <div class="card"><h3>🧠 AI Director</h3><p class="muted">Plan camera, lighting, weather, motion, music and scene continuity.</p></div>
      <div class="card"><h3>🎙️ Voice & Lip Sync</h3><p class="muted">Prepare dialogue, voice and human-like lip synchronization for the final video.</p></div>
    </section>
  </div>`);
}

function login(){
  page(`<div class="auth-wrap shell"><div class="auth">
    <div class="brand">Anim<span>AI</span></div><h1>Welcome back</h1><p class="muted">Sign in to your animation studio.</p>
    <form onsubmit="doLogin(event)">
      <div class="field"><label>Email</label><input id="email" type="email" required></div>
      <div class="field"><label>Password</label><input id="password" type="password" required></div>
      <button class="btn primary full">Login</button>
    </form>
    <div id="err" class="error"></div>
    <p class="muted">New here? <a href="#" onclick="register();return false;">Create account</a></p>
    <button class="btn secondary full" onclick="landing()">← Back</button>
  </div></div>`);
}

function register(){
  page(`<div class="auth-wrap shell"><div class="auth">
    <div class="brand">Anim<span>AI</span></div><h1>Create account</h1><p class="muted">Start building your animated stories.</p>
    <form onsubmit="doRegister(event)">
      <div class="field"><label>Name</label><input id="name" required></div>
      <div class="field"><label>Email</label><input id="email" type="email" required></div>
      <div class="field"><label>Password</label><input id="password" type="password" minlength="6" required></div>
      <button class="btn primary full">Register</button>
    </form>
    <div id="err" class="error"></div>
    <p class="muted">Already registered? <a href="#" onclick="login();return false;">Login</a></p>
    <button class="btn secondary full" onclick="landing()">← Back</button>
  </div></div>`);
}

async function api(path,options={}){
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  if(state.token) headers.Authorization=`Bearer ${state.token}`;
  const r=await fetch(API+path,{...options,headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    let message = data.message || `Request failed (${r.status})`;
    if(Array.isArray(data.detail)){
      message = data.detail.map(x=>x.msg || JSON.stringify(x)).join("; ");
    }else if(typeof data.detail === "string"){
      message = data.detail;
    }else if(data.detail){
      message = JSON.stringify(data.detail);
    }
    throw new Error(message);
  }
  return data;
}

async function doLogin(e){
  e.preventDefault();
  try{
    const emailInput=document.getElementById("email");
    const passwordInput=document.getElementById("password");
    const data=await api("/auth/login",{method:"POST",body:JSON.stringify({
      email:emailInput.value.trim(),password:passwordInput.value
    })});
    state.token=data.access_token||data.token||"demo";
    state.user=data.user||{email:emailInput.value.trim()};
    save();
    dashboard();
  }catch(err){
    document.getElementById("err").textContent=err.message;
  }
}

async function doRegister(e){
  e.preventDefault();
  try{
    const nameInput=document.getElementById("name");
    const emailInput=document.getElementById("email");
    const passwordInput=document.getElementById("password");
    await api("/auth/register",{method:"POST",body:JSON.stringify({
      name:nameInput.value.trim(),email:emailInput.value.trim(),password:passwordInput.value
    })});
    toast("Registration successful. Please login.");
    login();
  }catch(err){
    document.getElementById("err").textContent=err.message;
  }
}

function layout(content,active="dashboard"){
  page(`<div class="app-layout shell"><aside class="sidebar">
    <div class="side-title">Anim<span>AI</span></div>
    <div class="menu">
      <button class="${active==="dashboard"?"active":""}" onclick="dashboard()">🏠 Dashboard</button>
      <button class="${active==="create"?"active":""}" onclick="createStory()">✨ Create Animation</button>
      <button class="${active==="projects"?"active":""}" onclick="projects()">📁 My Projects</button>
      <button onclick="profile()">👤 Profile</button>
      <button onclick="logout()">↪ Logout</button>
    </div>
  </aside><main class="main">${content}</main></div>`);
}

async function dashboard(){
  await loadProjects();
  const name=state.user?.name||state.user?.email||"Creator";
  layout(`<div class="topbar"><div><h1>Welcome, ${esc(name)} 👋</h1><p class="muted">Create your next animated story.</p></div><button class="btn primary" onclick="createStory()">+ Create Animation</button></div>
  <div class="grid"><div class="card stat"><span class="muted">Projects</span><strong>${state.projects.length}</strong></div><div class="card stat"><span class="muted">AI Director</span><strong>Ready</strong></div><div class="card stat"><span class="muted">Video Pipeline</span><strong>Ready</strong></div></div>
  <div class="card" style="margin-top:16px"><h2>How AnimAI works</h2><p class="muted">1. Tell us your story → 2. Choose video length → 3. AnimAI analyzes the story → 4. Generate the production plan → 5. Connect the real AI video pipeline.</p><button class="btn primary" onclick="createStory()">Start creating</button></div>`);
}

function createStory(){
  layout(`<div class="topbar"><div><h1>Create Animation</h1><p class="muted">You describe what you want. AnimAI handles the production analysis.</p></div></div>
  <div class="card create-card"><div class="steps"><span class="step active">1 Story</span><span class="step active">2 Length</span><span class="step active">3 AI Analysis</span><span class="step">4 Generate</span></div>
  <form onsubmit="analyze(event)">
    <div class="field"><label>What do you want to create?</label><textarea id="story" required placeholder="Example: Sandy and Sai fall in love, but Sai's father Viru opposes their relationship..."></textarea></div>
    <div class="field"><label>Video length</label><select id="duration"><option value="30">30 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180">3 minutes</option><option value="300" selected>5 minutes</option></select></div>
    <div class="actions"><button class="btn secondary" type="button" onclick="dashboard()">Cancel</button><button class="btn primary">Analyze Story with AI →</button></div>
  </form>
  <div id="result"></div></div>`, "create");
}

function sceneCard(scene){
  const dialogue = scene.dialogue_text || scene.dialogue || "";
  return `<div class="card" style="margin-top:12px">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <div><strong>Scene ${esc(scene.id)}</strong><div class="muted">${esc(scene.start)}s – ${esc(scene.end)}s</div></div>
      <span class="badge">${esc(scene.emotion||"Story-consistent")}</span>
    </div>
    <p>${esc(scene.description||"")}</p>
    <div class="muted">Characters: ${esc((scene.characters||[]).join(", ") || "Story characters")}</div>
    <div class="muted">Action: ${esc(scene.action||scene.motion||"Natural movement")}</div>
    <div class="muted">Camera: ${esc(scene.camera||"Cinematic")}</div>
    <div class="muted">Time: ${esc(scene.time||"Story-consistent")} · Weather: ${esc(scene.weather||"Story-consistent")}</div>
    <div class="muted">Music: ${esc(scene.music||"Adaptive")} · SFX: ${esc(scene.sfx||"Natural ambience")}</div>
    ${dialogue ? `<div style="margin-top:8px"><strong>Dialogue:</strong> ${esc(dialogue)}</div>` : ""}
    ${scene.lip_sync ? `<div class="muted">👄 Lip Sync: Enabled</div>` : ""}
  </div>`;
}

function renderPlan(data){
  const plan=data.plan||{};
  const chars=plan.characters||[];
  const details=plan.character_details||[];
  const scenes=plan.scenes||[];
  return `<div class="result">
    <h3>✅ Story Analysis Complete</h3>
    <p class="muted">AnimAI created a cinematic production plan for ${esc(data.title||"your story")}.</p>
    <div class="grid">
      <div class="card"><strong>Characters</strong><p>${chars.length}</p></div>
      <div class="card"><strong>Scenes</strong><p>${scenes.length}</p></div>
      <div class="card"><strong>Duration</strong><p>${esc(data.duration||scenes.at(-1)?.end||"")} sec</p></div>
      <div class="card"><strong>Dialogue</strong><p>${plan.dialogue?"Auto-generated":"Not detected"}</p></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>🎭 Characters</h3>
      ${(details.length?details:chars.map(x=>({name:x,role:"Character",description:"Story character"}))).map(c=>`<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><strong>${esc(c.name)}</strong> — ${esc(c.role)}<div class="muted">${esc(c.description)}</div></div>`).join("")}
    </div>
    <div style="margin-top:16px"><h3>🎬 Cinematic Scene Plan</h3>${scenes.map(sceneCard).join("")}</div>
    <div class="card" style="margin-top:16px"><h3>🎥 Director Notes</h3><ul>${(plan.director_notes||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="card" style="margin-top:16px">
      <h3>🎞️ Production Pipeline</h3>
      <p class="muted">Upload a character/scene image to create your first real MP4 render. This local MVP adds cinematic camera motion; the external AI image-to-video model will be connected next.</p>
      <div class="field"><label>Character or scene image</label><input id="productionImage" type="file" accept="image/png,image/jpeg,image/webp"></div>
      <div class="actions"><button class="btn primary" onclick="startVideoGeneration('${esc(data.id)}')">Generate MP4 →</button><button class="btn secondary" onclick="projects()">My Projects</button></div>
      <div id="generationStatus" class="muted" style="margin-top:12px"></div>
      <div id="videoResult" style="margin-top:12px"></div>
    </div>
    <button class="btn secondary" style="margin-top:16px" onclick="projects()">View Projects</button>
  </div>`;
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}

async function startVideoGeneration(projectId){
  const input=document.getElementById("productionImage");
  const status=document.getElementById("generationStatus");
  const result=document.getElementById("videoResult");
  if(!input?.files?.[0]){ toast("Please choose an image first."); return; }
  status.textContent="⏳ Uploading image and starting the video render…";
  result.innerHTML="";
  try{
    const image_base64=await fileToDataUrl(input.files[0]);
    const data=await api(`/projects/${encodeURIComponent(projectId)}/generate`,{
      method:"POST", body:JSON.stringify({image_base64})
    });
    status.textContent="🎬 Video generation started. AnimAI is rendering the MP4…";
    pollVideo(projectId);
  }catch(err){
    status.textContent="";
    result.innerHTML=`<div class="result"><strong>Generation failed:</strong> ${esc(err.message)}</div>`;
  }
}

async function pollVideo(projectId){
  const status=document.getElementById("generationStatus");
  const result=document.getElementById("videoResult");
  let tries=0;
  const check=async()=>{
    tries++;
    try{
      const data=await api(`/projects/item/${encodeURIComponent(projectId)}`);
      if(data.status==="Completed" && data.video_ready){
        status.textContent="✅ MP4 generation completed.";
        const url=API+data.video_url;
        result.innerHTML=`<video controls style="width:100%;max-width:900px;border-radius:14px;margin-top:8px" src="${url}"></video><div style="margin-top:12px"><a class="btn primary" href="${url}" download="AnimAI_${projectId}.mp4">⬇ Download MP4</a></div>`;
        return;
      }
      if(data.status==="Failed"){
        status.textContent="❌ Video generation failed. Check the backend terminal for the FFmpeg error.";
        return;
      }
      status.textContent=`🎬 Rendering video… ${Math.min(95,tries*5)}%`;
      if(tries<120) setTimeout(check,3000);
      else status.textContent="⚠️ Rendering is taking longer than expected. Keep the backend running and refresh later.";
    }catch(err){
      if(tries<120) setTimeout(check,3000);
      else status.textContent="⚠️ Could not read generation status.";
    }
  };
  check();
}

async function analyze(e){
  e.preventDefault();
  const result=document.getElementById("result");
  result.innerHTML=`<div class="result">🧠 AnimAI is analyzing characters, scenes, emotions, actions, dialogue, camera, weather and music…</div>`;
  try{
    const data=await api("/projects/analyze",{method:"POST",body:JSON.stringify({
      user_id:state.user?.id||1,
      story:document.getElementById("story").value.trim(),
      duration:Number(document.getElementById("duration").value)
    })});
    result.innerHTML=renderPlan(data);
    loadProjects();
  }catch(err){
    result.innerHTML=`<div class="result"><h3>Analysis failed</h3><p class="muted">${esc(err.message)}</p><button class="btn secondary" onclick="createStory()">Try again</button></div>`;
  }
}

async function loadProjects(){
  try{
    const id=state.user?.id||1;
    const data=await api("/projects/"+id);
    state.projects=Array.isArray(data)?data:(data.projects||[]);
  }catch(e){}
}

async function projects(){
  await loadProjects();
  const rows=state.projects.length?state.projects.map(p=>`<div class="card project"><div><strong>${esc(p.project_name||p.title||"Untitled Project")}</strong><div class="muted">${esc(p.status||"Analyzed")}</div></div><span class="badge">${esc(p.status||"Ready")}</span></div>`).join(""):`<div class="card"><h3>No projects yet</h3><p class="muted">Create your first animation.</p><button class="btn primary" onclick="createStory()">Create Animation</button></div>`;
  layout(`<div class="topbar"><div><h1>My Projects</h1><p class="muted">Your animation projects.</p></div><button class="btn primary" onclick="createStory()">+ New</button></div>${rows}`,"projects");
}

function profile(){
  layout(`<div class="topbar"><h1>Profile</h1></div><div class="card"><h3>${esc(state.user?.name||"Creator")}</h3><p class="muted">${esc(state.user?.email||"")}</p></div>`);
}

function logout(){state.token="";state.user=null;localStorage.clear();landing();}
if(state.token) dashboard(); else landing();
