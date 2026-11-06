const $=selector=>document.querySelector(selector);
const API_BASE="https://alex-novel-reader.clinkballer.chatgpt.site";
const TOKEN_KEY="novelReaderToken";
const state={novels:[],detail:null,chapter:null,chapterIndex:0,showSource:false,translating:false,fontSize:Number(localStorage.getItem("readerFontSize")||19)};
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),4500)}
async function api(path,options={}){
  const token=localStorage.getItem(TOKEN_KEY);
  const headers={...(options.body?{"Content-Type":"application/json"}:{}),...(token?{"Authorization":"Bearer "+token}:{}),...(options.headers||{})};
  const response=await fetch(API_BASE+path,{...options,headers});
  let data;try{data=await response.json()}catch{throw new Error("The reader returned an unexpected response")}
  if(!response.ok)throw new Error(data.error||"Request failed");return data;
}
function post(path,data){return api(path,{method:"POST",body:JSON.stringify(data)})}
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
function showApp(){ $("#gate").hidden=true;$("#app").hidden=false;$("#logout").hidden=false;loadLibrary().catch(error=>toast(error.message)) }
async function initialize(){
  document.documentElement.style.setProperty("--reader-size",state.fontSize+"px");
  try{const info=await api("/api/session");if(/\/reset\/?$/.test(location.pathname)){
    if(info.needsSetup){location.href="../";return}
    $("#gate").hidden=true;$("#resetPage").hidden=false;return
  }if(info.authenticated){showApp();return}
    $("#gateTitle").innerHTML=info.needsSetup?"make this shelf<br><i>your own.</i>":"your next chapter<br><i>is waiting.</i>";
    $("#gateIntro").textContent=info.needsSetup?"Set a reader password to protect your library.":"Unlock your novels, translations, and continuity notes.";
    $("#gateHint").textContent=info.needsSetup?"Choose a password you'll remember. You can reset it with your secret word.":"";
    $("#gateForm").dataset.mode=info.needsSetup?"setup":"login";
    $("#setupSecretLabel").hidden=!info.needsSetup;
    $("#setupSecret").required=info.needsSetup;
    $("#resetLink").hidden=info.needsSetup;
    $("#gateForm button").firstChild.textContent=info.needsSetup?"Set password ":"Unlock ";
  }catch(error){$("#gateHint").textContent=error.message}
}
async function loadLibrary(){
  const data=await api("/api/library");state.novels=data.novels;const list=$("#novelList");list.replaceChildren();
  for(const novel of state.novels){const button=element("button","novel-item"+(state.detail?.novel.id===novel.id?" active":""));button.type="button";
    button.append(element("strong","",novel.title),element("span","",novel.translatedCount+" / "+novel.chapterCount+" chapters translated"));
    button.addEventListener("click",()=>openNovel(novel.id));list.append(button)}
  if(!state.novels.length){list.append(element("p","no-terms","No books yet. Add one to begin."));$("#emptyState").hidden=false}
  else if(!state.detail){const remembered=localStorage.getItem("readerNovelId");await openNovel(state.novels.some(x=>x.id===remembered)?remembered:state.novels[0].id)}
}
async function openNovel(id,preferredIndex){
  state.detail=await api("/api/novels/"+id);localStorage.setItem("readerNovelId",id);$("#bookTitle").textContent=state.detail.novel.title;
  $("#bookEyebrow").textContent=state.detail.chapters.length+" CHAPTERS / "+state.detail.novel.sourceLanguage.toUpperCase();
  $("#emptyState").hidden=true;$("#bookView").hidden=false;$("#addChapter").hidden=false;$(".shelf").classList.remove("open");
  const select=$("#chapterSelect");select.replaceChildren();state.detail.chapters.forEach((chapter,i)=>{const option=element("option","",String(i+1).padStart(2,"0")+"  "+chapter.title+(chapter.status==="translated"?"  ✓":""));option.value=String(i);select.append(option)});
  $("#continuityLink").href="continuity/?novel="+encodeURIComponent(id);
  await openChapter(Math.min(Math.max(preferredIndex??Number(localStorage.getItem("readerChapter:"+id)||0),0),state.detail.chapters.length-1));
  await loadLibraryListOnly();
}
async function loadLibraryListOnly(){
  const data=await api("/api/library");state.novels=data.novels;const list=$("#novelList");list.replaceChildren();
  for(const novel of state.novels){const button=element("button","novel-item"+(state.detail?.novel.id===novel.id?" active":""));button.type="button";button.append(element("strong","",novel.title),element("span","",novel.translatedCount+" / "+novel.chapterCount+" chapters translated"));button.addEventListener("click",()=>openNovel(novel.id));list.append(button)}
}
async function openChapter(index){
  if(!state.detail?.chapters.length)return;state.chapterIndex=index;localStorage.setItem("readerChapter:"+state.detail.novel.id,String(index));
  const meta=state.detail.chapters[index];state.chapter=(await api("/api/chapters/"+meta.id)).chapter;state.showSource=false;renderChapter();
}
function renderChapter(){
  const chapter=state.chapter;if(!chapter)return;$("#chapterSelect").value=String(state.chapterIndex);
  $("#chapterNumber").textContent=String(chapter.chapterNumber).padStart(2,"0")+" / CHAPTER";
  $("#chapterTitle").textContent=chapter.title;
  $("#chapterStatus").textContent=chapter.status==="translated"?"TRANSLATED":"RAW CHAPTER";
  $("#sourceToggle").textContent=state.showSource?"View translation":"View original";
  const text=state.showSource?chapter.sourceText:chapter.translatedText;
  $("#chapterText").textContent=text||"This chapter is waiting for translation. Start AI Studio on this PC and use the button at right.";
  $("#chapterText").classList.toggle("untranslated",!text);
  $("#previous").disabled=state.chapterIndex===0;$("#next").disabled=state.chapterIndex>=state.detail.chapters.length-1;
  $("#translateOne").textContent=chapter.status==="translated"?"Retranslate chapter →":"Translate chapter →";
}
function parseChapters(raw){
  const text=raw.replace(/\r\n?/g,"\n").trim();if(!text)return[];
  const lines=text.split("\n"),heading=/^\s*(?:chapter\s+[\divxlc]+(?:\s*[:.\-—]\s*.*)?|第\s*[0-9０-９一二三四五六七八九十百千万零〇]+\s*[章話回节節卷](?:\s*.*)?|제\s*\d+\s*화(?:\s*.*)?|\d+\s*화(?:\s*.*)?)\s*$/i;
  const chapters=[];let title="",parts=[];
  function flush(){const content=parts.join("\n").trim();if(content)chapters.push({title:title||"Chapter "+(chapters.length+1),sourceText:content});parts=[]}
  for(const line of lines){if(heading.test(line)){flush();title=line.trim()}else parts.push(line)}
  flush();return chapters.length?chapters:[{title:"Chapter 1",sourceText:text}];
}
function updateImportPreview(){const chapters=parseChapters($("#novelText").value);$("#importPreview").textContent=chapters.length?chapters.length+" chapter"+(chapters.length===1?"":"s")+" detected"+(chapters.some(c=>c.sourceText.length>30000)?" · one or more exceed 30,000 characters":""):""}
async function translate(index){
  const meta=state.detail.chapters[index],chapter=(await api("/api/chapters/"+meta.id)).chapter;
  let previousEnding="";if(index>0){const previous=(await api("/api/chapters/"+state.detail.chapters[index-1].id)).chapter;previousEnding=previous.translatedText.slice(-1200)}
  $("#translateStatus").textContent="Translating "+meta.title+" with local Qwen…";
  let response;try{response=await fetch("http://127.0.0.1:8765/api/novel/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sourceText:chapter.sourceText,chapterTitle:chapter.title,sourceLanguage:state.detail.novel.sourceLanguage,glossary:state.detail.glossary,contextNotes:state.detail.novel.contextNotes,previousEnding})})}
  catch{throw new Error("Cannot reach local AI Studio. Start it on this PC, then try again.")}
  const result=await response.json();if(!response.ok)throw new Error(result.error||"Local translation failed");
  await post("/api/chapters/"+meta.id+"/translation",result);
  const novelId=state.detail.novel.id;state.detail=await api("/api/novels/"+novelId);
  if(result.warning)toast(result.warning);return result;
}
async function runTranslation(all){
  if(state.translating||!state.detail)return;state.translating=true;$("#translateOne").disabled=true;$("#translateAll").disabled=true;
  try{const start=state.chapterIndex;for(let i=start;i<state.detail.chapters.length;i++){
    if(all&&state.detail.chapters[i].status==="translated")continue;
    await translate(i);await openNovel(state.detail.novel.id,i);
    $("#translateStatus").textContent="Saved chapter "+(i+1)+" of "+state.detail.chapters.length+".";
    if(!all)break;
  }toast("Translation saved to your private library")}
  catch(error){$("#translateStatus").textContent=error.message;toast(error.message)}
  finally{state.translating=false;$("#translateOne").disabled=false;$("#translateAll").disabled=false}
}
$("#gateForm").addEventListener("submit",async e=>{e.preventDefault();try{const result=await post("/api/auth/"+e.currentTarget.dataset.mode,{password:$("#password").value,secretWord:$("#setupSecret").value});localStorage.setItem(TOKEN_KEY,result.token);$("#password").value="";$("#setupSecret").value="";showApp()}catch(error){$("#gateHint").textContent=error.message}});
$("#resetForm").addEventListener("submit",async e=>{e.preventDefault();try{const result=await post("/api/auth/reset",{secretWord:$("#secretWord").value,password:$("#newPassword").value});localStorage.setItem(TOKEN_KEY,result.token);$("#secretWord").value="";$("#newPassword").value="";location.href="../"}catch(error){$("#resetHint").textContent=error.message}});
$("#logout").addEventListener("click",async()=>{try{await post("/api/auth/logout",{});localStorage.removeItem(TOKEN_KEY);location.reload()}catch(error){toast(error.message)}});
$("#newNovel").addEventListener("click",()=>$("#importDialog").showModal());$("#emptyAdd").addEventListener("click",()=>$("#importDialog").showModal());
$("#addChapter").addEventListener("click",()=>$("#chapterDialog").showModal());
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>$("#"+button.dataset.close).close()));
$("#novelFile").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>30000000){toast("Keep text files under 30 MB");return}$("#novelText").value=await file.text();if(!$("#novelTitle").value)$("#novelTitle").value=file.name.replace(/\.txt$/i,"");updateImportPreview()});
$("#novelText").addEventListener("input",updateImportPreview);
$("#importForm").addEventListener("submit",async e=>{e.preventDefault();const chapters=parseChapters($("#novelText").value);if(!chapters.length||chapters.length>2500||chapters.some(c=>c.sourceText.length>30000)){toast("Import 1–2,500 chapters, each under 30,000 characters");return}
  const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;let novelId="",saved=0;
  try{const result=await post("/api/novels",{title:$("#novelTitle").value,sourceLanguage:$("#novelLanguage").value,chapters:chapters.slice(0,25)});novelId=result.id;saved=Math.min(chapters.length,25);
    for(let i=25;i<chapters.length;i+=25){$("#importPreview").textContent="Saving "+saved+" of "+chapters.length+" chapters…";await post("/api/novels/"+novelId+"/chapters",{chapters:chapters.slice(i,i+25)});saved=Math.min(i+25,chapters.length)}
    $("#importDialog").close();$("#importForm").reset();$("#importPreview").textContent="";state.detail=null;await loadLibrary();await openNovel(novelId,0);toast(chapters.length+" chapters added to your shelf")}
  catch(error){$("#importPreview").textContent=novelId?saved+" chapters saved. The remaining chapters were not imported.":"";toast(error.message)}
  finally{submit.disabled=false}});
$("#chapterForm").addEventListener("submit",async e=>{e.preventDefault();try{await post("/api/chapters",{novelId:state.detail.novel.id,title:$("#newChapterTitle").value,sourceText:$("#newChapterText").value});$("#chapterDialog").close();$("#chapterForm").reset();await openNovel(state.detail.novel.id,state.detail.chapters.length);toast("Chapter added")}catch(error){toast(error.message)}});
$("#chapterSelect").addEventListener("change",e=>openChapter(Number(e.target.value)));$("#previous").addEventListener("click",()=>openChapter(state.chapterIndex-1));$("#next").addEventListener("click",()=>openChapter(state.chapterIndex+1));
$("#sourceToggle").addEventListener("click",()=>{state.showSource=!state.showSource;renderChapter()});
$("#fontDown").addEventListener("click",()=>{state.fontSize=Math.max(15,state.fontSize-1);localStorage.setItem("readerFontSize",state.fontSize);document.documentElement.style.setProperty("--reader-size",state.fontSize+"px")});
$("#fontUp").addEventListener("click",()=>{state.fontSize=Math.min(28,state.fontSize+1);localStorage.setItem("readerFontSize",state.fontSize);document.documentElement.style.setProperty("--reader-size",state.fontSize+"px")});
$("#translateOne").addEventListener("click",()=>runTranslation(false));$("#translateAll").addEventListener("click",()=>runTranslation(true));
$("#shelfToggle").addEventListener("click",()=>$(".shelf").classList.toggle("open"));
initialize();
