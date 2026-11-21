(function(root,factory) {
  const programming=factory();
  if (typeof module==='object' && module.exports) module.exports=programming;
  else root.DrivePortfolioSpectrumProgramming=programming;
})(globalThis,function() {
  'use strict';

  const width=512, height=256;
  const pale='#eef8f5';
  function paint(ctx,targetWidth,targetHeight,variant,write) {
    ctx.save();
    ctx.scale(targetWidth/width,targetHeight/height);
    ctx.textAlign='left';
    function rect(color,x,y,w,h) {
      ctx.fillStyle=color;
      ctx.fillRect(x,y,w,h);
    }
    function poly(color,points) {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      ctx.closePath();
      ctx.fillStyle=color;
      ctx.fill();
    }
    function line(color,thickness,...points) {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      ctx.strokeStyle=color;
      ctx.lineWidth=thickness;
      ctx.stroke();
    }
    function oval(color,x,y,rx,ry=rx,tilt=0) {
      ctx.beginPath();
      ctx.ellipse(x,y,rx,ry,tilt,0,Math.PI*2);
      ctx.fillStyle=color;
      ctx.fill();
    }
    function shade(top,bottom) {
      const tint=ctx.createLinearGradient(0,0,0,height);
      tint.addColorStop(0,top);
      tint.addColorStop(1,bottom);
      rect(tint,0,0,width,height);
    }
    function type(color,size,label,x,y,maxWidth,weight=750) {
      ctx.fillStyle=color;
      ctx.font=weight+' '+size+'px system-ui,sans-serif';
      write(label,x,y,maxWidth);
    }
    function live(color='#be2943',x=428,y=19) {
      rect(color,x,y,65,27);
      oval(pale,x+11,y+13.5,3);
      type(pale,18,'LIVE',x+20,y+20,39,850);
    }
    function person(x,y,s,tone,shirt,hair='#161c2c') {
      poly(shirt,[[x-53*s,y+81*s],[x-46*s,y+44*s],[x-17*s,y+30*s],[x+15*s,y+30*s],
        [x+46*s,y+42*s],[x+55*s,y+81*s]]);
      rect(tone,x-12*s,y+13*s,25*s,23*s);
      oval(tone,x,y,23*s,31*s);
      poly(hair,[[x-24*s,y+8*s],[x-29*s,y-8*s],[x-22*s,y-27*s],[x-4*s,y-36*s],[x+19*s,y-29*s],
        [x+27*s,y-17*s],[x+24*s,y+7*s],[x+18*s,y-12*s],[x+3*s,y-22*s],[x-12*s,y-13*s],[x-20*s,y+10*s]]);
      line('#302932',1.8*s,[x-14*s,y-1*s],[x-5*s,y-1*s]);
      line('#302932',1.8*s,[x+5*s,y-1*s],[x+13*s,y-1*s]);
      line('#9a645d',1.3*s,[x,y+1*s],[x-3*s,y+9*s],[x+2*s,y+10*s]);
      line('#633743',1.6*s,[x-7*s,y+17*s],[x+7*s,y+17*s]);
    }
    const draw={rect,poly,line,oval,shade,type,live,person};
    const index=((Math.trunc(variant)||0)%programs.length+programs.length)%programs.length;
    programs[index](draw);
    ctx.restore();
  }

  function nightDesk({rect,poly,line,shade,type,live,person}) {
    shade('#254475','#101e3c');
    for (const [x,w,h] of [[13,46,110],[68,30,144],[103,28,84],[138,21,101],[172,48,132],[232,21,92]]) {
      rect('#305381',x,171-h,w,h);
      for (let y=186-h;y<165;y+=14) rect('#52749a',x+4,y,w-8,2);
    }
    poly('#497fc5',[[0,39],[272,18],[319,34],[83,81],[0,82]]);
    line('#91d3ee',2,[0,88],[319,33],[510,37]);
    person(133,96,1.48,'#d3a286','#526da6');
    poly('#f1eae5',[[110,141],[147,142],[133,173]]);
    poly('#b43558',[[127,144],[138,144],[135,155],[142,179],[133,187],[124,180],[129,156]]);
    poly('#203252',[[0,178],[264,175],[296,199],[7,211]]);
    rect('#0f1e39',303,61,192,106);
    rect('#528cbd',310,67,178,92);
    poly('#245d89',[[310,141],[342,127],[355,98],[378,104],[400,82],[425,113],[460,95],[488,139],[488,159],[310,159]]);
    line('#abdbed',2,[315,150],[482,150]);
    rect('#e1f0f3',0,196,512,43);
    rect('#bc3450',0,196,109,43);
    type(pale,22,'NIGHT DESK',10,224,92,850);
    type('#162838',33,'WEST RING REOPENS',128,226,365,850);
    live();
  }

  function football({rect,line,oval,shade,type,live}) {
    shade('#1e3134','#344945');
    rect('#4c8455',0,41,512,204);
    for (let x=0;x<512;x+=86) rect('#5e965e',x,41,43,205);
    rect('#3d684d',0,229,512,27);
    line('#c5dec0',2,[17,58],[495,58],[495,221],[17,221],[17,58]);
    line('#c5dec0',2,[257,59],[257,220]);
    line('#c5dec0',2,[18,88],[85,88],[85,188],[18,188]);
    line('#c5dec0',2,[494,87],[425,87],[425,188],[494,188]);
    oval('#bfd9bd',258,138,42,36);
    oval('#55905a',258,138,39.5,33.5);
    oval('#c5dec0',258,138,2.5);
    const players=[
      [84,139,0],[146,83,0],[167,156,0],[227,119,0],[217,191,0],[313,94,0],
      [123,171,1],[202,111,1],[276,158,1],[354,170,1],[358,108,1],[446,142,1]
    ];
    for (const [x,y,team] of players) {
      oval('#23493d',x+2,y+8,7.6,3.2);
      oval(team ? '#ead17d' : '#bf5269',x,y,4.4,5.7,-.13);
      oval('#eac4a5',x,y-5.8,2.4);
      line('#263943',2,[x-2,y+4],[x-3,y+9],[x+2,y+7]);
    }
    oval('#252d36',270,148,3.7);
    oval('#faf6df',269.1,147,2.6);
    rect('#17282c',13,10,245,30);
    rect('#2f6e48',121,10,63,30);
    type(pale,21,'CITY 2',25,32,72);
    type(pale,21,'1 ORBIT',192,32,62);
    type(pale,18,'78:16',132,31,46);
    type('#e4eee0',18,'WEST RING LEAGUE',19,249,280,840);
    live('#b4374c',429,12);
  }

  function radar({rect,poly,line,oval,shade,type}) {
    shade('#183646','#101e35');
    for (let x=14;x<475;x+=38) line('#345465',1,[x,40],[x+9,241]);
    for (let y=49;y<243;y+=29) line('#345465',1,[0,y],[512,y+4]);
    poly('#537271',[[1,220],[37,187],[61,126],[83,110],[104,74],[131,100],[146,62],[169,93],[182,82],[215,131],[229,144],
      [249,177],[306,194],[370,195],[438,217],[512,226],[512,256],[0,256]]);
    poly('#3b5863',[[0,223],[68,172],[88,145],[94,122],[124,147],[146,78],[163,114],[187,111],[194,140],[219,157],[246,198],[512,233],[512,256],[0,256]]);
    const pulse=[['#318057',239,106,105,40],['#4db96a',255,102,85,31],['#8dd582',274,98,63,24],
      ['#ddce73',298,93,43,16],['#ed965e',317,89,21,9],['#4e9a72',362,155,54,21],['#67c675',377,150,35,12]];
    for (const [color,x,y,rx,ry] of pulse) oval(color,x,y,rx,ry,-.39);
    for (const [x,y] of [[167,166],[437,196],[277,190],[339,171]]) oval(pale,x,y,3);
    line('#a7b8aa',1.5,[168,164],[276,191],[337,170],[438,195],[486,186]);
    type(pale,31,'DOPPLER RADAR',19,37,389,850);
    type('#c3dfde',19,'WEST RING',14,205,178);
    const bands=['#45896c','#64b97b','#95c977','#d9c477','#db875d','#cd4d60'];
    for (const [i,color] of bands.entries()) rect(color,218+i*43,227,43,15);
    type('#d0e5e5',16,'LIGHT',219,220,54);
    type('#d0e5e5',16,'HEAVY',421,220,54);
  }

  function cinema({rect,poly,line,oval,shade,type}) {
    shade('#843443','#2d2240');
    oval('#e58a65',289,91,72);
    for (const [x,w,h] of [[4,53,65],[62,22,105],[88,51,89],[139,72,54],[246,36,81],[282,49,60],[335,44,139],[384,50,128],[451,60,80]]) {
      rect('#463146',x,157-h,w,h+13);
    }
    poly('#202033',[[323,175],[342,124],[372,103],[382,71],[394,60],[414,64],[433,80],[430,102],
      [442,111],[460,125],[484,178],[479,256],[304,256]]);
    line('#de796d',3,[382,76],[393,63],[414,65],[431,82]);
    line('#ae6070',3,[367,111],[394,108],[427,118],[454,138]);
    poly('#141929',[[0,177],[325,149],[512,194],[512,256],[0,256]]);
    rect('#bd5665',21,37,110,23);
    type(pale,18,'FILM TONIGHT',29,54,92,820);
    type('#f6d3b8',52,'AFTER THE STATIC',20,218,470,900);
    line('#df7969',3,[22,231],[272,231]);
  }

  function traffic({rect,poly,line,shade,type,live}) {
    shade('#666371','#273645');
    poly('#293041',[[0,146],[90,136],[184,42],[246,33],[188,115],[301,102],[468,0],[512,0],
      [512,35],[374,124],[512,165],[512,220],[318,161],[218,260],[142,260],[210,176],[0,204]]);
    poly('#8d786d',[[72,0],[199,0],[117,99],[0,109],[0,62]]);
    poly('#5d6d75',[[320,3],[457,1],[294,97],[180,113]]);
    poly('#826e69',[[361,175],[499,216],[512,251],[288,254]]);
    for (const xs of [[4,173,443,124],[195,242,365,101],[59,19,0,80],[121,121,248,30],[325,137,509,191]]) {
      line('#687984',2,[xs[0],xs[1]],[xs[2],xs[3]]);
    }
    for (const [x,y,angle,color] of [[102,162,-.12,'#d6bc7d'],[70,184,-.12,'#96bed2'],[175,158,-.14,'#eaa4af'],
      [250,186,-.66,'#a7c5d8'],[312,136,-.52,'#dfab79'],[396,166,.25,'#d4d7a3'],[375,94,-.57,'#b09ccb'],
      [242,76,-.84,'#a5d0d3'],[430,76,-.58,'#f7a976'],[481,55,-.6,'#a4d2d1']]) {
      poly(color,[[x-9,y-2+7*angle],[x+9,y-2-7*angle],[x+9,y+3-7*angle],[x-9,y+3+7*angle]]);
    }
    rect('#24474c',0,213,512,43);
    rect('#dca667',13,223,5,23);
    type('#eff1e1',31,'EAST RING TRAFFIC',30,246,440,850);
    live('#a95142',429,12);
  }

  function fieldReport({rect,poly,line,oval,shade,type,live,person}) {
    shade('#416384','#252943');
    poly('#25364e',[[0,96],[111,53],[172,67],[205,109],[301,82],[420,37],[512,71],[512,200],[0,200]]);
    poly('#64788b',[[0,154],[200,117],[310,139],[512,103],[512,156],[304,181],[0,202]]);
    for (const [x,y] of [[37,77],[90,54],[234,85],[356,61],[411,50],[485,78]]) {
      rect('#243248',x,y,7,74);
      oval('#e4b59b',x+2,y,8,3);
    }
    poly('#4a4256',[[155,193],[208,162],[332,155],[380,167],[432,166],[462,183],[512,184],[512,224],[0,224]]);
    person(373,95,1.59,'#bf876c','#a44159','#272338');
    line('#bbd4da',5,[359,145],[344,176]);
    oval('#303044',358,142,8,11);
    rect('#ca4554',0,182,183,29);
    type(pale,21,'FIELD REPORT',14,203,151,880);
    rect('#e5e2e1',0,211,512,45);
    type('#29263d',33,'OUTSIDE THE GATE',14,244,483,860);
    live();
  }

  function basketball({rect,poly,line,oval,shade,type}) {
    shade('#1d2c52','#242a45');
    for (let row=0;row<3;row++) {
      for (let i=0;i<32;i++) oval(row===1 ? '#756685' : '#3e557e',i*17,39+row*11+(i%3)*2,3.6,3.0);
    }
    poly('#c38962',[[0,115],[512,86],[512,226],[0,256]]);
    for (let x=38;x<511;x+=67) line('#ae765b',2,[x,108],[x-34,249]);
    line('#eecbb2',2,[15,130],[496,104],[502,217],[18,245],[15,130]);
    line('#eecbb2',2,[252,117],[254,231]);
    poly('#596889',[[49,154],[140,148],[140,200],[49,204]]);
    line('#eecbb2',2,[50,153],[141,147],[141,201],[50,205]);
    line('#c9e3e8',3,[102,79],[102,129],[128,133]);
    line('#ffd099',3,[127,134],[146,133]);
    for (const [x,y,uniform] of [[151,154,'#6c87c5'],[198,170,'#f0c47e'],[244,174,'#6c87c5'],[311,157,'#f0c47e'],[369,171,'#6c87c5']]) {
      oval('#986754',x+3,y+27,10,4);
      line(uniform,6,[x-9,y+9],[x+1,y],[x+11,y+10]);
      line('#332d42',4,[x,y+9],[x-5,y+21],[x-11,y+25]);
      line('#332d42',4,[x+3,y+9],[x+7,y+21],[x+12,y+23]);
      rect(uniform,x-5,y-2,11,16);
      oval('#d79f83',x,y-9,5.2);
    }
    oval('#ec9856',181,115,6);
    rect('#1b2946',13,11,486,25);
    rect('#576bbd',11,12,131,24);
    rect('#96695e',368,12,131,24);
    type(pale,18,'METRO 68',23,30,103,860);
    type(pale,18,'4TH / 03:26',207,30,113,800);
    type(pale,18,'FOOTHILLS 65',377,30,112,860);
  }

  function concert({rect,poly,line,oval,shade,type,live}) {
    shade('#42234f','#211932');
    for (const [from,to,color] of [[13,180,'#e24b7659'],[488,325,'#c975bd76'],[133,240,'#8984f68a'],[382,218,'#9e64ad70']]) {
      poly(color,[[from-4,0],[from+7,0],[to+72,209],[to-56,209]]);
    }
    for (const y of [57,85,113,141]) line('#bd78a3',1.5,[145,y],[374,y+5]);
    oval('#2e2447',245,140,101,80);
    oval('#ba6fa2',245,140,100,78);
    oval('#482750',245,140,93,70);
    poly('#292137',[[217,187],[226,145],[247,132],[244,115],[248,103],[259,100],[272,108],[276,123],
      [269,135],[289,143],[308,186],[287,197],[203,198]]);
    line('#3b2846',7,[232,148],[207,155],[182,135]);
    line('#3c2947',6,[285,152],[316,117],[321,99]);
    oval('#ef8db3',320,98,6,4);
    for (let i=0;i<17;i++) {
      const x=7+i*32,y=208-(i*17%23);
      oval('#211c35',x,y,11,15);
      oval('#211c35',x,y+21,19,18);
    }
    rect('#332246',0,219,512,37);
    type('#faadd0',31,'AFTER HOURS',18,248,266,880);
    type('#d7bee0',18,'LIVE SESSION',330,246,177,750);
    live('#ae4f81',430,15);
  }

  function forecast({rect,line,oval,shade,type}) {
    shade('#3d5578','#28446c');
    type('#e7f3f4',33,'OVERNIGHT FORECAST',18,40,477,850);
    const periods=[
      {x:14,name:'NOW',degree:'46°',tone:'#3d718f',rain:true},
      {x:179,name:'LATER',degree:'42°',tone:'#385580',rain:true},
      {x:344,name:'DAWN',degree:'39°',tone:'#44658c',rain:false}
    ];
    for (const {x,name,degree,tone,rain} of periods) {
      rect(tone,x,61,154,179);
      rect('#7191aa',x,61,154,3);
      type('#e3f4f8',24,name,x+15,97,123,850);
      if (!rain) oval('#f2ce8f',x+103,126,22);
      oval('#d1e1e8',x+59,137,20,12);
      oval('#d1e1e8',x+78,130,19,17);
      oval('#d1e1e8',x+98,141,17,10);
      rect('#d1e1e8',x+59,139,39,11);
      if (rain) for (const dx of [58,76,94]) line('#86d4ea',3,[x+dx,156],[x+dx-5,167]);
      type('#fff1cc',54,degree,x+14,221,123,840);
    }
  }

  function documentary({rect,poly,line,oval,shade,type}) {
    shade('#826650','#3f474d');
    oval('#d9ad72',408,72,56);
    poly('#5f625c',[[0,132],[68,112],[139,125],[262,83],[340,140],[453,113],[512,132],[512,203],[0,203]]);
    poly('#44484b',[[0,191],[309,165],[512,139],[512,175],[280,208],[0,234]]);
    const cars=[[10,93,135,76],[144,99,112,67],[254,104,92,57],[343,106,75,51],[416,109,72,46]];
    for (const [x,y,w,h] of cars) {
      poly('#786150',[[x,y+3],[x+w-7,y],[x+w,y+8],[x+w,y+h-8],[x+8,y+h],[x,y+h-10]]);
      rect('#ae8765',x+6,y+10,w-12,h*.40);
      for (let i=10;i<w-16;i+=23) rect('#494a50',x+i,y+13,17,h*.26);
      line('#ba9270',2,[x+4,y+h*.58],[x+w-4,y+h*.52]);
      oval('#403939',x+w*.28,y+h-1,9,6);
      oval('#403939',x+w*.76,y+h-4,9,6);
    }
    rect('#342d36',0,208,512,48);
    type('#efca9f',34,'FREIGHT AFTER DARK',17,243,446,850);
    rect('#a16950',17,16,131,28);
    type(pale,19,'DOCUMENTARY',25,37,115,800);
  }

  const programs=[nightDesk,football,radar,cinema,traffic,fieldReport,basketball,concert,forecast,documentary];
  return {paint,count:programs.length};
});
