const $=selector=>document.querySelector(selector);
const API_BASE="https://alex-novel-reader.clinkballer.chatgpt.site";
const TOKEN_KEY="novelReaderToken";
const accent=localStorage.getItem("readerAccentColor");if(/^#[0-9a-f]{6}$/i.test(accent||"")){const rgb=[1,3,5].map(index=>parseInt(accent.slice(index,index+2),16));document.documentElement.style.setProperty("--accent",accent);document.documentElement.style.setProperty("--accent-ink",(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000>150?"#102117":"#fff")}
const state={novels:[],detail:null};
async function api(path,options={}){
  const token=localStorage.getItem(TOKEN_KEY);
  const headers={...(options.body?{"Content-Type":"application/json"}:{}),...(token?{"Authorization":"Bearer "+token}:{}),...(options.headers||{})};
  const response=await fetch(API_BASE+path,{...options,headers});
  let data;try{data=await response.json()}catch{throw new Error("The reader returned an unexpected response")}
  if(!response.ok)throw new Error(data.error||"Request failed");return data;
}
function node(tag,className,value){const item=document.createElement(tag);if(className)item.className=className;if(value!==undefined)item.textContent=value;return item}
function editTerm(entry){
  $("#termForm").reset();$("#termSource").readOnly=!!entry;
  if(entry){$("#termSource").value=entry.sourceTerm;$("#termEnglish").value=entry.englishTerm;$("#termCategory").value=entry.category;$("#termGender").value=entry.gender||"";$("#termDetails").value=entry.details||""}
  $("#termDialog").showModal();
}
function renderTerms(){
  const list=$("#glossaryList"),query=$("#termSearch").value.trim().toLocaleLowerCase(),category=$("#categoryFilter").value;
  list.replaceChildren();if(!state.detail)return;
  const entries=(state.detail.glossary||[]).filter(entry=>(category==="all"||entry.category===category)&&(!query||[entry.sourceTerm,entry.englishTerm,entry.details].some(value=>String(value||"").toLocaleLowerCase().includes(query))));
  $("#message").textContent=entries.length+" of "+(state.detail.glossary||[]).length+" terms";
  if(!entries.length){list.append(node("p","no-terms","No matching terms yet."));return}
  for(const entry of entries){const item=node("div","term"),line=node("div");item.tabIndex=0;item.setAttribute("role","button");item.setAttribute("aria-label","Edit "+entry.englishTerm);line.append(node("strong","",entry.englishTerm),node("span","source",entry.sourceTerm));item.append(line,node("small","",entry.category+(entry.gender?" · "+entry.gender:"")),node("p","",entry.details||""));item.addEventListener("click",()=>editTerm(entry));item.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();editTerm(entry)}});list.append(item)}
}
async function openNovel(id){
  state.detail=await api("/api/novels/"+encodeURIComponent(id));$("#novelSelect").value=id;$("#contextNotes").textContent=state.detail.novel.contextNotes||"No story notes yet.";
  $("#addTerm").disabled=false;history.replaceState(null,"","?novel="+encodeURIComponent(id));renderTerms();
}
async function initialize(){
  try{
    const session=await api("/api/session");if(!session.authenticated){location.replace("../");return}
    const library=await api("/api/library");state.novels=library.novels||[];const select=$("#novelSelect");
    for(const novel of state.novels){const option=node("option","",novel.title);option.value=novel.id;select.append(option)}
    if(!state.novels.length){$("#message").textContent="No books yet. Add one from the reader.";return}
    const requested=new URLSearchParams(location.search).get("novel"),remembered=localStorage.getItem("readerNovelId");
    await openNovel(state.novels.find(n=>n.id===requested)?.id||state.novels.find(n=>n.id===remembered)?.id||state.novels[0].id);
  }catch(error){$("#message").textContent=error.message}
}
$("#novelSelect").addEventListener("change",event=>openNovel(event.target.value).catch(error=>$("#message").textContent=error.message));
$("#termSearch").addEventListener("input",renderTerms);$("#categoryFilter").addEventListener("change",renderTerms);
$("#addTerm").addEventListener("click",()=>editTerm(null));$("#closeDialog").addEventListener("click",()=>$("#termDialog").close());
$("#termForm").addEventListener("submit",async event=>{event.preventDefault();const submit=event.currentTarget.querySelector('[type="submit"]');submit.disabled=true;try{await api("/api/glossary",{method:"POST",body:JSON.stringify({novelId:state.detail.novel.id,sourceTerm:$("#termSource").value,englishTerm:$("#termEnglish").value,category:$("#termCategory").value,gender:$("#termGender").value,details:$("#termDetails").value})});$("#termDialog").close();await openNovel(state.detail.novel.id)}catch(error){$("#message").textContent=error.message}finally{submit.disabled=false}});
initialize();
