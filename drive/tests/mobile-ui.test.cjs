const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {setup} = require('../js/mobile-ui');

function harness({supported=true, standalone=false, prefixed=false, enabled=true, request}={}) {
  class Element {
    constructor(){this.listeners={};this.attributes={};this.hidden=false;this.disabled=false;}
    addEventListener(name,fn,options){this.listeners[name]={fn,options};}
    setAttribute(name,value){this.attributes[name]=value;}
    focus(){document.activeElement=this;}
    send(name,event={}){return this.listeners[name]?.fn(event);}
  }
  const elements=new Map();
  const document=new Element();
  document.querySelector=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  document.documentElement=new Element();
  const window={navigator:{standalone},matchMedia:()=>({matches:false,addEventListener(){}})};
  let releases=0,resizes=0,requests=0,exits=0;
  if(supported) {
    document[prefixed?'webkitFullscreenEnabled':'fullscreenEnabled']=enabled;
    document.documentElement[prefixed?'webkitRequestFullscreen':'requestFullscreen']=async function(options){
      assert.equal(this,document.documentElement);
      assert.equal(options.navigationUI,'hide'); requests++;
      if(request)await request();
      document[prefixed?'webkitFullscreenElement':'fullscreenElement']=this;
      document.send(prefixed?'webkitfullscreenchange':'fullscreenchange');
    };
    document[prefixed?'webkitExitFullscreen':'exitFullscreen']=async function(){
      assert.equal(this,document);exits++;
      document[prefixed?'webkitFullscreenElement':'fullscreenElement']=null;
      document.send(prefixed?'webkitfullscreenchange':'fullscreenchange');
    };
  }
  const canvas=new Element(),controls=Array.from({length:5},()=>new Element());
  const button=document.querySelector('#fullscreenButton'),help=document.querySelector('#screenHelp');
  help.hidden=true;
  setup({document,window,canvas,controls,releaseControls:()=>releases++,resize:()=>resizes++});
  return {document,window,canvas,controls,button,help,close:document.querySelector('#screenHelpClose'),message:document.querySelector('#screenHelpMessage'),counts:()=>({releases,resizes,requests,exits})};
}

test('native touch gestures are canceled only on canvas/pedals, never document/forms/links',()=>{
  const h=harness();
  for(const element of [h.canvas,...h.controls]) for(const name of ['touchstart','touchmove','touchend']) {
    const listener=element.listeners[name];
    assert.equal(listener.options.passive,false);
    let prevented=0;
    element.send(name,{cancelable:true,preventDefault(){prevented++;},touches:[{},{}]});
    assert.equal(prevented,1);
    element.send(name,{cancelable:false,preventDefault(){throw Error('noncancelable');}});
  }
  for(const element of [h.document,h.button,h.help,h.document.querySelector('#mapSelect'),h.document.querySelector('a')]) {
    assert.equal(element.listeners.touchstart,undefined);
    assert.equal(element.listeners.touchmove,undefined);
  }
});

test('fullscreen is user-initiated, supports exit, and synchronizes after browser exit',async()=>{
  for(const prefixed of [false,true]) {
    const h=harness({prefixed});
    assert.equal(h.counts().requests,0);
    assert.equal(h.button.textContent,'FULL SCREEN');
    await h.button.send('click');
    assert.equal(h.counts().requests,1);
    assert.equal(h.button.textContent,'EXIT FULL SCREEN');
    assert.equal(h.button.attributes['aria-pressed'],'true');
    assert.equal(h.button.disabled,false);
    await h.button.send('click');
    assert.equal(h.counts().exits,1);
    assert.equal(h.button.textContent,'FULL SCREEN');
    await h.button.send('click');
    h.document[prefixed?'webkitFullscreenElement':'fullscreenElement']=null;
    h.document.send(prefixed?'webkitfullscreenchange':'fullscreenchange');
    assert.equal(h.button.attributes['aria-pressed'],'false');
    assert.equal(h.button.textContent,'FULL SCREEN');
    assert.ok(h.counts().releases>=4 && h.counts().resizes>=4);
  }
});

test('repeated clicks while fullscreen is pending cannot start duplicate requests',async()=>{
  let finish;
  const pending=new Promise(resolve=>finish=resolve),h=harness({request:()=>pending});
  const first=h.button.send('click');
  assert.equal(h.button.disabled,true);
  await h.button.send('click');
  assert.equal(h.counts().requests,1);
  finish();await first;
  assert.equal(h.button.disabled,false);
});

test('unsupported or policy-disabled fullscreen offers dismissible app-view help',async()=>{
  for(const options of [{supported:false},{enabled:false}]) {
    const h=harness(options);
    assert.equal(h.button.textContent,'APP VIEW');
    await h.button.send('click');
    assert.equal(h.counts().requests,0);
    assert.equal(h.help.hidden,false);
    assert.equal(h.document.activeElement,h.close);
    assert.match(h.message.textContent,/cannot/);
    assert.equal(h.button.attributes['aria-expanded'],'true');
    h.help.send('keydown',{key:'Escape',preventDefault(){}});
    assert.equal(h.help.hidden,true);
    assert.equal(h.document.activeElement,h.button);
    await h.button.send('click');h.close.send('click');
    assert.equal(h.help.hidden,true);
  }
});

test('denied fullscreen does not strand controls or claim active fullscreen',async()=>{
  const h=harness({request:async()=>{throw Error('NotAllowedError');}});
  await h.button.send('click');
  assert.equal(h.button.disabled,false);
  assert.equal(h.button.attributes['aria-pressed'],'false');
  assert.equal(h.help.hidden,false);
  assert.match(h.message.textContent,/unavailable or declined/);
  assert.equal(h.counts().releases,1);
  assert.ok(h.counts().resizes>0);
});

test('installed app view does not request fullscreen again',async()=>{
  const h=harness({standalone:true});
  assert.equal(h.button.textContent,'APP VIEW');
  assert.equal(h.button.disabled,true);
  assert.equal(h.button.attributes['aria-pressed'],'true');
  await h.button.send('click');assert.equal(h.counts().requests,0);
});

test('home-screen configuration stays scoped to drive and retains user scaling',()=>{
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(require.resolve('../manifest.webmanifest'),'utf8'));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
  assert.match(html,/apple-mobile-web-app-capable" content="yes/);
  assert.match(html,/Open as Web App/);
  assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
  assert.ok(html.indexOf('js/mobile-ui.js')<html.indexOf('js/main.js'));
});
