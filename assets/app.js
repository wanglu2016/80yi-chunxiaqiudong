'use strict';
const B=window.ATLAS_DATA;
const $=id=>document.getElementById(id);
const AZ=['睡觉','工作','上学学习','通勤出行','吃饭洗漱','家务照料','休闲社交'];
const ACOL=['#3987e5','#c98500','#199e70','#d95926','#9085e9','#d55181','#00a3b8'];
const GZ={infant:['婴幼儿','0–5 岁'],pupil:['中小学生','6–17 岁在校'],college:['大学生','高等教育在读'],office:['固定班上班族','白天上班的雇员'],shift:['轮班工作者','医护、工厂、运输、夜班'],flex:['个体与灵活就业','小店、摊贩、自雇、家庭帮工'],home:['在家的成年人','照料家庭、待业'],senior:['退休老人','65 岁以上未就业']};
const TIER=['','一线 · 超大城市','二线','三线','四线'];
const WEEK=['周日','周一','周二','周三','周四','周五','周六'];
const RAD=Math.PI/180,YEAR=B.year,T0=Date.UTC(YEAR,0,1),T1=Date.UTC(YEAR+1,0,1),DAY=864e5;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad2=n=>String(n).padStart(2,'0');
const tag=(k,t)=>`<span class="tag" data-k="${k}" title="${t||({实:'来自统计或观测数据',算:'由太阳位置公式算出',估:'模型估算，不是实测',画:'为了可视化的动画表现'})[k]}">${k}</span>`;
function people(n){if(n>=1e8)return(n/1e8).toFixed(n>=1e9?1:2)+' 亿';if(n>=1e4)return(n>=1e7?Math.round(n/1e4):(n/1e4).toFixed(n>=1e6?0:1))+' 万';return Math.round(n).toLocaleString('zh-CN')}
function aLabel(g,k){if(k===2){if(g==='infant')return'托幼';if(g==='pupil')return'上课或写作业';if(g==='college')return'上课或自习'}
 if(k===6&&g==='infant')return'玩耍';if(k===1&&g==='shift')return'当班';if(k===1&&g==='flex')return'经营或接单';return AZ[k]}
function hhmm(h){h=((h%24)+24)%24;let H=Math.floor(h),M=Math.round((h-H)*60);if(M===60){M=0;H=(H+1)%24}return pad2(H)+':'+pad2(M)}
function b64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function offLabel(o){const s=o<0?'−':'+',a=Math.abs(o),h=Math.floor(a/60),m=a%60;return'UTC'+s+h+(m?':'+pad2(m):'')}

/* ---------- data ---------- */
const dLa=new Int16Array(b64(B.dla).buffer),dLo=new Int16Array(b64(B.dlo).buffer),dZo=new Uint16Array(b64(B.dzo).buffer);
const N=dLa.length,pos=new Float32Array(N*3),aZone=new Float32Array(N),aU=new Float32Array(N),dSin=new Float32Array(N),dCos=new Float32Array(N),dLon=new Float32Array(N),dW=new Float32Array(N);
const cDots=new Float64Array(B.C.length);B.Z.forEach(z=>cDots[z[0]]+=z[2]);
const zW=B.Z.map(z=>B.C[z[0]].p*z[2]/cDots[z[0]]),zLa=new Float64Array(B.Z.length),zLo=new Float64Array(B.Z.length),zN=new Float64Array(B.Z.length),zSx=new Float64Array(B.Z.length),zCx=new Float64Array(B.Z.length);
for(let i=0;i<N;i++){const la=dLa[i]/100*RAD,lo=dLo[i]/100*RAD,c=Math.cos(la),z=dZo[i];pos[i*3]=c*Math.sin(lo);pos[i*3+1]=Math.sin(la);pos[i*3+2]=c*Math.cos(lo);aZone[i]=z;aU[i]=(i*.61803398875)%1;dSin[i]=Math.sin(la);dCos[i]=c;dLon[i]=dLo[i]/100;
 dW[i]=zW[z]/B.Z[z][2];zLa[z]+=dLa[i]/100;zSx[z]+=Math.sin(lo);zCx[z]+=Math.cos(lo);zN[z]++}
for(let z=0;z<B.Z.length;z++){zLa[z]/=zN[z]||1;zLo[z]=Math.atan2(zSx[z],zCx[z])/RAD}
const CITIES=B.CITY.map((c,i)=>{const la=c.la*RAD,lo=c.lo*RAD,cc=Math.cos(la);const tier=c.p>=1e7?1:c.p>=3e6?2:c.p>=1e6?3:4;
 return Object.assign(c,{i,vx:cc*Math.sin(lo),vy:Math.sin(la),vz:cc*Math.cos(lo),tier,cn:B.C[c.c],tz:B.T[c.t],temps:c.cl>=0?B.CL[c.cl].t:null,key:'c'+i})});
function byTier(a,b){return a.tier-b.tier||b.p-a.p}
const LABEL_ORDER=CITIES.slice().sort(byTier);

/* ---------- state ---------- */
const S={ms:0,mode:'day',hover:null,pin:null,lon0:110,lat0:18,zoom:1,play:null};
const dirty={view:true,time:true};
function viewerOff(ms){return-new Date(ms).getTimezoneOffset()}
function axisOff(ms){return S.pin?tzOffsetMin(S.pin.tz,ms):viewerOff(ms)}
function axisToUtc(dayIdx,minutes){let g=T0+dayIdx*DAY+minutes*6e4;g-=axisOff(g)*6e4;return T0+dayIdx*DAY+minutes*6e4-axisOff(g)*6e4}
function axisParts(ms){const o=axisOff(ms),d=new Date(ms+o*6e4);return{o,mo:d.getUTCMonth(),d:d.getUTCDate(),dow:d.getUTCDay(),h:d.getUTCHours(),m:d.getUTCMinutes(),doy:Math.floor((Date.UTC(YEAR,d.getUTCMonth(),d.getUTCDate())-T0)/DAY)}}
function setTime(ms){while(ms<T0)ms+=T1-T0;while(ms>=T1)ms-=T1-T0;S.ms=ms;dirty.time=true}
{const n=new Date();const g=Date.UTC(YEAR,n.getMonth(),n.getDate(),n.getHours(),n.getMinutes());setTime(g+n.getTimezoneOffset()*6e4)}
function solarEvent(target){let lo=T0,hi=T1;const f=t=>((sunVec(t).lam-target+540)%360)-180;for(let t=T0;t<T1;t+=5*DAY){const a=f(t),b=f(t+5*DAY);if(a<=0&&b>0&&b-a<20){lo=t;hi=t+5*DAY;break}}for(let i=0;i<40;i++){const m=(lo+hi)/2;if(f(m)<=0)lo=m;else hi=m}return lo}
const EVENTS=[[0,'春分'],[90,'夏至'],[180,'秋分'],[270,'冬至']].map(([l,n])=>({n,ms:solarEvent(l)}));

/* ---------- WebGL ---------- */
const stage=$('stage'),glc=$('gl'),ovc=$('ov'),ov=ovc.getContext('2d');
const gl=glc.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:false});
const G={};let W=0,H=0,DPR=1,CX=0,CY=0,R=1;
const VS_Q=`#version 300 es
in vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FS_S=`#version 300 es
precision highp float;uniform vec2 uC;uniform float uR;uniform mat3 uRot;uniform vec3 uSun;uniform sampler2D uLand;out vec4 o;
const float PI=3.14159265;
float line(float v,float w){float d=fwidth(v);return 1.-smoothstep(0.,d*1.2,abs(v)-w*.0);}
void main(){vec2 q=(gl_FragCoord.xy-uC)/uR;float r2=dot(q,q);
 vec3 bg=vec3(.024,.039,.078);
 if(r2>1.){float r=sqrt(r2);vec3 n=vec3(q/r,0.);vec3 w=transpose(uRot)*n;float s=dot(w,uSun);float a=clamp(1.-(r-1.)/.075,0.,1.);a=a*a*a;
  vec3 glow=mix(vec3(.05,.09,.2),vec3(.33,.58,.95),smoothstep(-.25,.7,s));o=vec4(bg+glow*a*.8,1.);return;}
 float z=sqrt(1.-r2);vec3 n=vec3(q,z);vec3 w=transpose(uRot)*n;float lat=asin(clamp(w.y,-1.,1.));float lon=atan(w.x,w.z);
 vec2 uv=vec2(lon/(2.*PI)+.5,.5-lat/PI);float land=texture(uLand,uv).r;
 float s=dot(w,uSun);float day=smoothstep(-.03,.1,s);float lit=day*(.42+.58*clamp(s,0.,1.));
 vec3 oc=mix(vec3(.018,.033,.066),vec3(.09,.2,.31),lit);vec3 ld=mix(vec3(.055,.072,.105),vec3(.32,.36,.34),lit);
 vec3 c=mix(oc,ld,land);
 float tw=smoothstep(-.21,-.02,s)*(1.-smoothstep(-.02,.13,s));c+=vec3(.6,.27,.16)*tw*.26;
 float dl=degrees(lat),dn=degrees(lon);
 float g1=min(abs(fract(dn/30.+.5)-.5)*30.,abs(fract(dl/30.+.5)-.5)*30.);float aa=fwidth(dn)+fwidth(dl);
 c+=vec3(.2,.26,.36)*.16*(1.-smoothstep(0.,aa*.8,g1));
 float t1=min(abs(abs(dl)-23.44),abs(abs(dl)-66.56));c+=vec3(1.,.78,.38)*.2*(1.-smoothstep(0.,fwidth(dl)*1.,t1))*step(.5,fract(dn/4.));
 float rim=pow(1.-z,3.);c+=mix(vec3(.03,.05,.11),vec3(.16,.3,.52),smoothstep(-.2,.5,s))*rim;
 c*=.72+.28*sqrt(z);o=vec4(c,1.);}`;
const VS_L=`#version 300 es
in vec3 p;uniform mat3 uRot;uniform vec2 uC;uniform float uR;uniform vec2 uRes;out float v;
void main(){vec3 q=uRot*p;v=q.z;vec2 s=uC+q.xy*uR;gl_Position=vec4(s/uRes*2.-1.,0.,1.);}`;
const FS_L=`#version 300 es
precision mediump float;in float v;out vec4 o;void main(){if(v<0.)discard;o=vec4(.72,.78,.88,.2*smoothstep(0.,.25,v));}`;
const VS_D=`#version 300 es
in vec3 p;in float z;in float u;uniform mat3 uRot;uniform vec2 uC;uniform float uR;uniform vec2 uRes;uniform vec3 uSun;uniform float uSize;uniform int uMode;uniform float uTan;uniform highp sampler2D uZ;uniform vec3 uPal[7];out vec4 vc;
void main(){vec3 q=uRot*p;if(q.z<-.01){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;return;}
 vec2 s=uC+q.xy*uR;gl_Position=vec4(s/uRes*2.-1.,0.,1.);gl_PointSize=uSize;float edge=smoothstep(-.01,.14,q.z);vec3 c;float a;
 if(uMode==0){float h=dot(p,uSun);vec3 ni=vec3(1.,.73,.36);vec3 tw=vec3(1.,.5,.42);vec3 da=vec3(.95,.97,1.);c=mix(ni,tw,smoothstep(-.12,-.03,h));c=mix(c,da,smoothstep(-.02,.1,h));a=mix(.5,.2,smoothstep(-.02,.12,h));}
 else if(uMode==1){int zi=int(z+.5);vec4 a0=texelFetch(uZ,ivec2(zi,0),0);vec4 a1=texelFetch(uZ,ivec2(zi,1),0);int k=6;
  if(u<a0.r)k=0;else if(u<a0.g)k=1;else if(u<a0.b)k=2;else if(u<a0.a)k=3;else if(u<a1.r)k=4;else if(u<a1.g)k=5;c=uPal[k]*1.35;a=k==0?.34:.86;}
 else{float t=clamp(-p.y/max(.0001,sqrt(1.-p.y*p.y))*uTan,-1.,1.);float len=acos(t)/3.14159265;c=len<.5?mix(vec3(.25,.53,.98),vec3(.8,.82,.86),smoothstep(.3,.5,len)):mix(vec3(.8,.82,.86),vec3(1.,.66,.14),smoothstep(.5,.66,len));a=.8;}
 vc=vec4(c,a*edge);}`;
const FS_D=`#version 300 es
precision mediump float;in vec4 vc;out vec4 o;void main(){vec2 d=gl_PointCoord-.5;float r=dot(d,d);if(r>.25)discard;o=vec4(vc.rgb,vc.a*(1.-r*3.2));}`;
function prog(vs,fs){const mk=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x};
 const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,vs));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
function uni(p,names){const u={};names.forEach(n=>u[n]=gl.getUniformLocation(p,n));return u}
function hex3(h){return[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255)}
function initGL(){
 G.s=prog(VS_Q,FS_S);G.su=uni(G.s,['uC','uR','uRot','uSun','uLand']);
 G.l=prog(VS_L,FS_L);G.lu=uni(G.l,['uRot','uC','uR','uRes']);
 G.d=prog(VS_D,FS_D);G.du=uni(G.d,['uRot','uC','uR','uRes','uSun','uSize','uMode','uTan','uZ','uPal']);
 G.vq=gl.createVertexArray();gl.bindVertexArray(G.vq);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);let a=gl.getAttribLocation(G.s,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
 const bd=new Int16Array(b64(B.bord).buffer),seg=[];let prev=null;for(let i=0;i<bd.length;i+=2){if(bd[i]===-32768){prev=null;continue}const la=bd[i]/100*RAD,lo=bd[i+1]/100*RAD,c=Math.cos(la),v=[c*Math.sin(lo),Math.sin(la),c*Math.cos(lo)];if(prev)seg.push(...prev,...v);prev=v}
 G.nl=seg.length/3;G.vl=gl.createVertexArray();gl.bindVertexArray(G.vl);const bl=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bl);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(seg),gl.STATIC_DRAW);a=gl.getAttribLocation(G.l,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,0,0);
 G.vd=gl.createVertexArray();gl.bindVertexArray(G.vd);
 const put=(n,arr,sz)=>{const q=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,q);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);const l=gl.getAttribLocation(G.d,n);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,sz,gl.FLOAT,false,0,0)};
 put('p',pos,3);put('z',aZone,1);put('u',aU,1);gl.bindVertexArray(null);
 G.zt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,G.zt);G.zd=new Uint8Array(B.Z.length*2*4);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,B.Z.length,2,0,gl.RGBA,gl.UNSIGNED_BYTE,G.zd);[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(f=>gl.texParameteri(gl.TEXTURE_2D,f,gl.NEAREST));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 G.lt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,G.lt);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
 const im=new Image();im.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,G.lt);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);dirty.view=true};im.src='data:image/png;base64,'+B.land;
 gl.useProgram(G.d);gl.uniform3fv(G.du.uPal,new Float32Array(ACOL.flatMap(hex3)));
}
function rotMat(){const a=S.lon0*RAD,b=S.lat0*RAD,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
 // world → view, rows
 return[ca,0,-sa, -sb*sa,cb,-sb*ca, cb*sa,sb,cb*ca]}
function colMajor(m){return new Float32Array([m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]])}
function sunDir(ms){const{dec,eot}=sunVec(ms),utc=((ms%DAY)+DAY)%DAY/36e5,lon=-15*(utc-12+eot/60);const c=Math.cos(dec),l=lon*RAD;return{v:[c*Math.sin(l),Math.sin(dec),c*Math.cos(l)],dec:dec/RAD,lon:((lon+540)%360)-180}}
function resize(){const r=stage.getBoundingClientRect();W=r.width;H=r.height;DPR=Math.min(2,devicePixelRatio||1);[glc,ovc].forEach(c=>{c.width=Math.round(W*DPR);c.height=Math.round(H*DPR)});
 const wide=innerWidth>1180;const left=wide?336:0,right=wide?404:0;CX=wide?(left+(W-right))/2:W/2;CY=H/2+(wide?8:0);R=Math.min((W-left-right)*.5,H*.47)*.98;dirty.view=true;drawChart();sizeRibbon()}
function radius(){return R*S.zoom}
function project(c,M){const x=M[0]*c.vx+M[1]*c.vy+M[2]*c.vz,y=M[3]*c.vx+M[4]*c.vy+M[5]*c.vz,z=M[6]*c.vx+M[7]*c.vy+M[8]*c.vz,r=radius();return{sx:CX+x*r,sy:CY-y*r,z}}
function draw(){const M=rotMat();const sn=sunDir(S.ms);
 if(gl){gl.viewport(0,0,glc.width,glc.height);gl.disable(gl.BLEND);
  const cg=[CX*DPR,(H-CY)*DPR],rp=radius()*DPR,cm=colMajor(M);
  gl.useProgram(G.s);gl.bindVertexArray(G.vq);gl.uniform2fv(G.su.uC,cg);gl.uniform1f(G.su.uR,rp);gl.uniformMatrix3fv(G.su.uRot,false,cm);gl.uniform3fv(G.su.uSun,sn.v);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,G.lt);gl.uniform1i(G.su.uLand,0);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(G.l);gl.bindVertexArray(G.vl);gl.uniform2fv(G.lu.uC,cg);gl.uniform1f(G.lu.uR,rp);gl.uniform2f(G.lu.uRes,glc.width,glc.height);gl.uniformMatrix3fv(G.lu.uRot,false,cm);gl.drawArrays(gl.LINES,0,G.nl);
  gl.blendFunc(gl.SRC_ALPHA,S.mode==='day'?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(G.d);gl.bindVertexArray(G.vd);gl.uniform2fv(G.du.uC,cg);gl.uniform1f(G.du.uR,rp);gl.uniform2f(G.du.uRes,glc.width,glc.height);gl.uniformMatrix3fv(G.du.uRot,false,cm);gl.uniform3fv(G.du.uSun,sn.v);
  gl.uniform1f(G.du.uSize,DPR*Math.min(3.2,(radius()/340)*1.25+.45));gl.uniform1i(G.du.uMode,S.mode==='day'?0:S.mode==='act'?1:2);gl.uniform1f(G.du.uTan,Math.tan(sn.dec*RAD));
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,G.zt);gl.uniform1i(G.du.uZ,1);gl.drawArrays(gl.POINTS,0,N);gl.bindVertexArray(null)}
 drawOverlay(M,sn)}
function drawOverlay(M,sn){ov.setTransform(DPR,0,0,DPR,0,0);ov.clearRect(0,0,W,H);
 ov.textBaseline='middle';const pts=[];
 for(const c of CITIES){const p=project(c,M);if(p.z>.06&&p.sx>-20&&p.sx<W+20&&p.sy>-20&&p.sy<H+20)pts.push([c,p])}
 const fade=z=>Math.min(1,(z-.04)*6);
 const rad=[0,3.1,2.1,1.5,1.1],zf=Math.min(1.6,.85+.15*S.zoom)*Math.max(.62,Math.min(1,R/300));
 for(const[c,p]of pts){const r=rad[c.tier]*zf;ov.globalAlpha=fade(p.z)*(c.tier>2?.72:1);ov.beginPath();ov.arc(p.sx,p.sy,r+.9,0,6.3);ov.fillStyle='rgba(6,10,20,.75)';ov.fill();ov.beginPath();ov.arc(p.sx,p.sy,r,0,6.3);ov.fillStyle=c.tier===1?'#ffc861':c.tier===2?'#ece7da':'#b9c1d2';ov.fill()}
 ov.globalAlpha=1;
 const boxes=[];const inBox=(x,y,w,h)=>boxes.some(b=>x<b[0]+b[2]&&x+w>b[0]&&y<b[1]+b[3]&&y+h>b[1]);
 ov.font='12px "Noto Sans SC","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
 const put=(c,p,strong)=>{const tw=ov.measureText(c.z).width,x=p.sx+6,y=p.sy;if(!strong&&(inBox(x-2,y-8,tw+4,16)||x+tw>W-4))return;boxes.push([x-2,y-8,tw+4,16]);ov.globalAlpha=strong?1:fade(p.z);ov.lineWidth=3;ov.strokeStyle='rgba(6,10,20,.85)';ov.strokeText(c.z,x,y);ov.fillStyle=strong?'#ffc861':'#ece7da';ov.fillText(c.z,x,y)};
 const cur=S.hover||S.pin;
 if(cur){const p=project(cur,M);if(p.z>0){ov.globalAlpha=1;ov.strokeStyle='#ffc861';ov.lineWidth=1.4;ov.beginPath();ov.arc(p.sx,p.sy,9,0,6.3);ov.stroke();ov.font='500 13px "Noto Sans SC","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';put(cur,p,true);ov.font='12px "Noto Sans SC","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif'}}
 const maxT=S.zoom>2.2?3:S.zoom>1.4?2:1;
 for(const c of LABEL_ORDER){if(c.tier>maxT)break;if(c===cur)continue;const p=pts.find(q=>q[0]===c);if(p)put(c,p[1],false)}
 ov.globalAlpha=1;const ss={vx:sn.v[0],vy:sn.v[1],vz:sn.v[2]},q=project(ss,M);
 if(q.z>0){ov.strokeStyle='#ffc861';ov.lineWidth=1.2;ov.beginPath();ov.arc(q.sx,q.sy,7,0,6.3);ov.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ov.beginPath();ov.moveTo(q.sx+Math.cos(a)*9,q.sy+Math.sin(a)*9);ov.lineTo(q.sx+Math.cos(a)*12.5,q.sy+Math.sin(a)*12.5);ov.stroke()}}
}

/* ---------- world stats ---------- */
const stat={day:0,tw:0,night:0,act:new Float64Array(7)};
function recomputeWorld(){const ms=S.ms,{dec,eot}=sunVec(ms),utc=((ms%DAY)+DAY)%DAY/36e5,sd=Math.sin(dec),cd=Math.cos(dec),base=15*(utc-12+eot/60);
 const s0=Math.sin(-.833*RAD),s1=Math.sin(-6*RAD);let d=0,t=0,n=0;
 for(let i=0;i<N;i++){const s=dSin[i]*sd+dCos[i]*cd*Math.cos((base+dLon[i])*RAD),w=dW[i];if(s>s0)d+=w;else if(s>s1)t+=w;else n+=w}
 const sum=d+t+n;stat.day=d/sum*B.world;stat.tw=t/sum*B.world;stat.night=n/sum*B.world;
 stat.act.fill(0);let tot=0;const zd=G.zd;
 for(let z=0;z<B.Z.length;z++){const Zr=B.Z[z],cn=B.C[Zr[0]],tz=B.T[Zr[1]];const r=evalPlace(B,cn,tz,zLa[z],zLo[z],ms,0,null,'z'+z,false);const w=zW[z];tot+=w;let c=0;
  for(let k=0;k<7;k++){stat.act[k]+=r.act[k]*w;c+=r.act[k];if(zd&&k<6){const v=Math.min(255,Math.round(c*255));const row=k<4?0:1,col=k<4?k:k-4;zd[(row*B.Z.length+z)*4+col]=v}}}
 for(let k=0;k<7;k++)stat.act[k]/=tot;
 if(gl&&G.zt){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,G.zt);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,B.Z.length,2,gl.RGBA,gl.UNSIGNED_BYTE,zd)}}
function barHTML(vals){return vals.map((v,k)=>`<i style="width:${(v*100).toFixed(2)}%;background:${ACOL[k]}" title="${AZ[k]} ${(v*100).toFixed(0)}%"></i>`).join('')}
function renderWorld(){const dv=stat.day,tv=stat.tw,nv=stat.night,sn=sunDir(S.ms),lat=sn.dec;
 const ns=lat>=0?'北纬':'南纬';const a=stat.act;
 $('now').innerHTML=`<div class="eyebrow">此刻的人类</div>
 <div class="tally"><b>${(B.world/1e8).toFixed(1)}</b><span>亿人${tag('实','联合国《世界人口展望 2024》2026 年中位预测，年中人口')}</span></div>
 <div class="bar" role="img" aria-label="昼夜人口比例"><i style="width:${dv/B.world*100}%;background:#f2d58f"></i><i style="width:${tv/B.world*100}%;background:#d9785a"></i><i style="width:${nv/B.world*100}%;background:#34466f"></i></div>
 <div class="split"><div>白昼<b>${(dv/1e8).toFixed(1)} 亿</b></div><div>曙暮光<b>${(tv/1e8).toFixed(1)} 亿</b></div><div>黑夜<b>${(nv/1e8).toFixed(1)} 亿</b></div></div>
 <div class="block eyebrow">分别在做什么${tag('估')}</div>
 <div class="bar" role="img" aria-label="全球活动比例">${barHTML([...a])}</div>
 <div class="rows">${[...a].map((v,k)=>`<i style="background:${ACOL[k]}"></i><span>${AZ[k]}</span><span class="v">${(v*B.world/1e8).toFixed(1)} 亿</span><span class="p">${(v*100).toFixed(0)}%</span>`).join('')}</div>
 <div class="warn">太阳直射${ns} ${Math.abs(lat).toFixed(1)}°${tag('算')}。${S.mode==='act'?'这个主题下，每个光点按所在地的估算比例抽一种活动，颜色不代表真实个人。':S.mode==='len'?'这个主题下，光点颜色只表示所在纬度今天的昼长：蓝色短，灰色约 12 小时，金色长。':'光点颜色只表示太阳位置。光点变暗不代表那里的人睡着了。'}
 <div class="key"><span>${tag('实')}统计数据</span><span>${tag('算')}天文计算</span><span>${tag('估')}模型估算</span><span>${tag('画')}动画表现</span></div>
 <div class="more"><button id="linkNotes" type="button">数据来源与模型说明</button><a href="https://wanglu2016.github.io/80yi-chunxiaqiudong/video.html">视频讲解</a><a href="https://github.com/wanglu2016/80yi-chunxiaqiudong">GitHub</a></div></div>`;
 $('linkNotes').onclick=()=>$('notes').showModal()}

/* ---------- city card ---------- */
function seasonOf(lat,mo){if(Math.abs(lat)<23.44)return'热带，四季不明显';const n=[3,3,0,0,0,1,1,1,2,2,2,3][mo],k=lat>0?n:(n+2)%4;return['春季','夏季','秋季','冬季'][k]}
function currentCity(){return S.hover||S.pin}
function renderCard(){const c=currentCity();$('cHint').hidden=!!c;$('cBody').hidden=!c;if(!c)return;
 const r=evalPlace(B,c.cn,c.tz,c.la,c.lo,S.ms,c.tier,c.temps,c.key,true),dc=r.dc,lp=r.lp,st=dc.st;
 const alt=altitude(c.la,c.lo,S.ms);
 const phase=alt>-.833?'白昼':alt>-6?'曙暮光':'黑夜';
 const lenM=Math.round(st.len*60),dayline=st.polar==='day'?'今天太阳不落（极昼）':st.polar==='night'?'今天太阳不升（极夜）':`日出 ${hhmm(st.sr)} · 日落 ${hhmm(st.ss)} · 昼长 ${Math.floor(lenM/60)} 时 ${lenM%60} 分`;
 const srcL=c.s==='wup'?'联合国 WUP 2025，都市集聚区，2025 年':'Natural Earth 汇编的都市区人口，年份不一';
 let tempL='暂无这座城市附近的常年气温数据';
 if(c.temps){const t=monthTemp(c.temps,lp),s=B.CL[c.cl];tempL=`${lp.mo+1} 月常年约 ${Math.round(t)}°C${c.cd>40?`（最近的站点：${s.n}，相距 ${c.cd} 公里）`:''}`}
 const dayType=dc.isHol?'公共假期':dc.wkEnd?'周末':'工作日';
 const chips=[`<span class="chip">${dayType}</span>`];
 if(dc.isHol&&dc.hn!==undefined&&B.HN[dc.hn]!=='公共假期')chips.push(`<span class="chip on">${B.HN[dc.hn]}</span>`);
 if(dc.ct&&c.cn.mk&&c.cn.mk.includes(dc.key))chips.push('<span class="chip on">调休上班日</span>');
 if(dc.sbreak)chips.push('<span class="chip">学校放假（近似）</span>');
 if(dc.ram)chips.push('<span class="chip on">斋月</span>');
 $('cHead').innerHTML=`<div class="cname"><h2>${c.z}</h2><span>${c.cn.z}</span><span class="tier">${TIER[c.tier]}</span>${S.pin===c&&!S.hover?'<button id="unpin" type="button">取消选中</button>':''}</div>
 <div class="cpop"><b>${people(c.p)}</b><span>${tag('实',srcL)} ${c.s==='wup'?'联合国 2025 年':'都市区，年份不一'}</span></div>
 <dl class="facts"><dt>当地</dt><dd>${lp.mo+1}月${lp.d}日 ${WEEK[lp.dow]} ${hhmm(lp.h)} · ${offLabel(lp.o)}</dd>
 <dt>太阳</dt><dd>${phase} ${alt.toFixed(0)}°${tag('算')} · ${dayline}</dd>
 <dt>季节</dt><dd>${seasonOf(c.la,lp.mo)}，${tempL}${c.temps?tag('实','常年月均气温，来自公开整理表，按日插值，不是当天天气'):''}</dd></dl>
 <div class="chips">${chips.join('')}</div>`;
 const u=$('unpin');if(u)u.onclick=()=>pin(null);
 $('cTitle').innerHTML=`此刻这 ${people(c.p)} 人在做什么`;
 const a=[...r.act];$('cBar').innerHTML=barHTML(a);
 const order=a.map((v,k)=>[v,k]).filter(x=>x[0]>=.005);
 $('cRows').innerHTML=order.map(([v,k])=>`<i style="background:${ACOL[k]}"></i><span>${AZ[k]}</span><span class="v">${people(v*c.p)}</span><span class="p">${(v*100).toFixed(0)}%</span>`).join('');
 const gs=r.groups.filter(g=>g.share>=.002);
 $('gTitle').innerHTML=`<span>这座城市的人可分成 <b>${gs.length} 类</b></span>${tag('估','按全国年龄、就业和入学结构推算，未单独校正这座城市')}`;
 $('cGroups').innerHTML=gs.map(g=>{const ks=[...g.act].map((v,k)=>[v,k]).sort((x,y)=>y[0]-x[0]).slice(0,3).filter(x=>x[0]>=.04);
  return`<div class="grp"><div><b>${GZ[g.g][0]}</b><small>${GZ[g.g][1]}</small></div><span class="n">${people(g.share*c.p)}</span>
  <div class="bar">${barHTML([...g.act])}</div><div class="say">${ks.map(([v,k])=>`${aLabel(g.g,k)} ${(v*100).toFixed(0)}%`).join(' · ')}</div></div>`}).join('');
 drawRibbon(c,lp)}
/* 24-hour ribbon */
const rib=$('ribbon');let ribData=null,ribKey='';
function sizeRibbon(){const w=rib.getBoundingClientRect().width||330;rib.width=Math.round(w*DPR);rib.height=Math.round(74*DPR);ribKey=''}
function drawRibbon(c,lp){const key=c.key+lp.mo+'-'+lp.d;
 if(key!==ribKey){ribKey=key;const mid=Date.UTC(lp.y,lp.mo,lp.d)-lp.o*6e4;ribData=[];for(let q=0;q<96;q++){const r=evalPlace(B,c.cn,c.tz,c.la,c.lo,mid+q*9e5+45e4,c.tier,c.temps,c.key,true);ribData.push([...r.act])}$('ribDay').textContent=`${lp.mo+1}月${lp.d}日`}
 const x=rib.getContext('2d'),Wd=rib.width,Ht=rib.height,cw=Wd/96;x.clearRect(0,0,Wd,Ht);
 for(let q=0;q<96;q++){let y=Ht;for(let k=0;k<7;k++){const h=ribData[q][k]*Ht;x.fillStyle=ACOL[k];x.fillRect(q*cw,y-h,cw+.6,h);y-=h}}
 const nx=lp.h/24*Wd;x.fillStyle='#ffc861';x.fillRect(nx-DPR*.75,0,DPR*1.5,Ht)}
rib.addEventListener('pointermove',e=>{if(!ribData)return;const r=rib.getBoundingClientRect(),q=Math.max(0,Math.min(95,Math.floor((e.clientX-r.left)/r.width*96)));const d=ribData[q].map((v,k)=>[v,k]).sort((a,b)=>b[0]-a[0]).slice(0,3);$('ribTip').textContent=`${hhmm(q/4)}　`+d.map(([v,k])=>`${AZ[k]} ${(v*100).toFixed(0)}%`).join(' · ')});
rib.addEventListener('pointerleave',()=>{$('ribTip').textContent=''});

/* ---------- sun chart ---------- */
const chart=$('chart'),cx2=chart.getContext('2d'),heat=document.createElement('canvas');heat.width=365;heat.height=96;
const PAD={l:30,t:18,r:6,b:3};let daylightPx=null,heatKey='';
function lerpStops(st,t){t=Math.max(0,Math.min(1,t));const n=st.length-1,i=Math.min(n-1,Math.floor(t*n)),u=t*n-i,a=st[i],b=st[i+1];return[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]}
const WRAMP=[[8,14,32],[20,38,84],[52,84,132],[150,136,110],[244,206,120]];
function altColor(a){if(a<-18)return[7,11,24];if(a<-6){const u=(a+18)/12;return[7+20*u,11+26*u,24+56*u]}if(a<-.833){const u=(a+6)/5.167;return[27+190*u,37+95*u,80+0*u]}const u=Math.min(1,(a+.833)/62);return[232+18*u,172+66*u,96+96*u]}
function rebuildHeat(){const k=S.pin?S.pin.key:'world';if(k===heatKey)return;if(!S.pin&&!daylightPx)return;heatKey=k;const hx=heat.getContext('2d'),im=hx.createImageData(365,96),d=im.data;
 for(let dd=0;dd<365;dd++)for(let r=0;r<96;r++){const ms=axisToUtc(dd,r*15+7.5);let c;
  if(S.pin)c=altColor(altitude(S.pin.la,S.pin.lo,ms));
  else{const sl=Math.max(0,Math.min(35039,Math.floor((ms-T0)/9e5))),di=Math.floor(sl/96),q=sl%96,v=daylightPx[(di*96+q)*4]/255;c=lerpStops(WRAMP,(v-.11)/.79)}
  const i=(r*365+dd)*4;d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255}
 hx.putImageData(im,0,0)}
function plot(){const w=chart.clientWidth,h=chart.clientHeight;return{x:PAD.l,y:PAD.t,w:w-PAD.l-PAD.r,h:h-PAD.t-PAD.b,cw:w,ch:h}}
function drawChart(){const dp=Math.min(2,devicePixelRatio||1),w=chart.clientWidth,h=chart.clientHeight;if(!w||!h)return;if(chart.width!==Math.round(w*dp)||chart.height!==Math.round(h*dp)){chart.width=Math.round(w*dp);chart.height=Math.round(h*dp)}
 rebuildHeat();const P=plot(),x=cx2;x.setTransform(dp,0,0,dp,0,0);x.clearRect(0,0,w,h);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(heat,P.x,P.y,P.w,P.h);
 x.font='11px "IBM Plex Mono",Menlo,monospace';x.fillStyle='#a3acbf';x.textAlign='right';x.textBaseline='middle';
 for(const hh of[0,6,12,18,24]){const y=P.y+hh/24*P.h;x.fillText(String(hh),P.x-5,Math.min(P.y+P.h-4,Math.max(P.y+5,y)));x.fillStyle='rgba(236,231,218,.14)';x.fillRect(P.x,Math.round(y),P.w,1);x.fillStyle='#a3acbf'}
 x.textBaseline='alphabetic';x.textAlign='left';x.font='12px "Noto Sans SC","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
 const small=P.w<520;for(let m=0;m<12;m++){const d=(Date.UTC(YEAR,m,1)-T0)/DAY,xx=P.x+d/365*P.w;x.fillStyle='rgba(236,231,218,.14)';x.fillRect(Math.round(xx),P.y,1,P.h);x.fillStyle='#a3acbf';if(!small||m%2===0)x.fillText((m+1)+'月',xx+3,12)}
 x.strokeStyle='rgba(255,200,97,.85)';x.setLineDash([3,3]);x.lineWidth=1;for(const e of EVENTS){const ap=axisParts(e.ms),xx=Math.round(P.x+(ap.doy+.5)/365*P.w)+.5;x.beginPath();x.moveTo(xx,P.y);x.lineTo(xx,P.y+P.h);x.stroke()}x.setLineDash([]);if(P.h>110){x.font='11px "Noto Sans SC","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';for(const e of EVENTS){const ap=axisParts(e.ms),xx=P.x+(ap.doy+.5)/365*P.w;x.lineWidth=3;x.strokeStyle='rgba(6,10,20,.8)';x.textAlign='left';x.strokeText(e.n,xx+4,P.y+P.h-5);x.fillStyle='#ffc861';x.fillText(e.n,xx+4,P.y+P.h-5)}}
 const ap=axisParts(S.ms),cx=P.x+(ap.doy+.5)/365*P.w,cy=P.y+(ap.h+ap.m/60)/24*P.h;x.strokeStyle='#ffffff';x.lineWidth=1;x.beginPath();x.moveTo(Math.round(cx)+.5,P.y);x.lineTo(Math.round(cx)+.5,P.y+P.h);x.moveTo(P.x,Math.round(cy)+.5);x.lineTo(P.x+P.w,Math.round(cy)+.5);x.stroke();
 x.fillStyle='#ffc861';x.beginPath();x.arc(cx,cy,5,0,6.3);x.fill();x.strokeStyle='#0b1120';x.lineWidth=2;x.stroke();
 $('chartCap').textContent=S.pin?`图：${S.pin.z}全年的白昼（亮）、曙暮光（红）和黑夜，虚线是节气`:'图：全人类处在白昼的比例（11%–90%），虚线是节气';
 chart.setAttribute('aria-valuetext',`${ap.mo+1}月${ap.d}日 ${pad2(ap.h)}:${pad2(ap.m)}`)}
function chartPick(e){const r=chart.getBoundingClientRect(),P=plot(),dx=Math.max(0,Math.min(364,Math.floor((e.clientX-r.left-P.x)/P.w*365))),m=Math.max(0,Math.min(1439,Math.round((e.clientY-r.top-P.y)/P.h*1440/5)*5));return{dx,m}}
let chartDrag=false;
chart.addEventListener('pointerdown',e=>{chartDrag=true;chart.setPointerCapture(e.pointerId);stopPlay();const p=chartPick(e);setTime(axisToUtc(p.dx,p.m))});
chart.addEventListener('pointermove',e=>{const tip=$('chartTip'),p=chartPick(e),ms=axisToUtc(p.dx,p.m);const ap=axisParts(ms);
 let share='';if(daylightPx&&!S.pin){const sl=Math.max(0,Math.min(35039,Math.floor((ms-T0)/9e5))),di=Math.floor(sl/96),q=sl%96;share=` · ${Math.round(daylightPx[(di*96+q)*4]/2.55)}% 的人在白昼`}
 else if(S.pin){const a=altitude(S.pin.la,S.pin.lo,ms);share=` · 太阳高度 ${a.toFixed(0)}°`}
 tip.textContent=`${ap.mo+1}月${ap.d}日 ${pad2(ap.h)}:${pad2(ap.m)}${share}`;tip.hidden=false;const r=chart.getBoundingClientRect();tip.style.left=Math.max(90,Math.min(r.width-90,e.clientX-r.left))+'px';tip.style.top=(e.clientY-r.top)+'px';
 if(chartDrag)setTime(ms)});
chart.addEventListener('pointerup',()=>{chartDrag=false});chart.addEventListener('pointerleave',()=>{if(!chartDrag)$('chartTip').hidden=true});
chart.addEventListener('keydown',e=>{const k=e.key;const stepM={ArrowUp:-15,ArrowDown:15}[k],stepD={ArrowLeft:-1,ArrowRight:1,PageUp:-30,PageDown:30}[k];if(stepM){setTime(S.ms+stepM*6e4);e.preventDefault()}else if(stepD){setTime(S.ms+stepD*DAY);e.preventDefault()}else if(k==='Home'){jumpNow();e.preventDefault()}});

/* ---------- controls ---------- */
function fillMonth(){const m=$('sMonth');for(let i=0;i<12;i++)m.add(new Option((i+1)+'月',i))}
function fillDay(mo){const s=$('sDay'),n=new Date(Date.UTC(YEAR,mo+1,0)).getUTCDate();if(s.options.length!==n){s.length=0;for(let d=1;d<=n;d++)s.add(new Option(d+'日',d))}}
function renderClock(){const ap=axisParts(S.ms);$('clock').innerHTML=`${ap.mo+1}月${ap.d}日 ${pad2(ap.h)}:${pad2(ap.m)}<small>${WEEK[ap.dow]}</small>`;
 const sn=sunDir(S.ms);$('zoneL').textContent=S.pin?`${S.pin.z}当地时间 ${offLabel(ap.o)} · ${YEAR} 年`:`你的时间 ${offLabel(ap.o)} · ${YEAR} 年`;
 fillDay(ap.mo);$('sMonth').value=ap.mo;$('sDay').value=ap.d;if(document.activeElement!==$('sTime'))$('sTime').value=pad2(ap.h)+':'+pad2(ap.m)}
function fromControls(){const mo=+$('sMonth').value;fillDay(mo);const d=+$('sDay').value,[h,m]=($('sTime').value||'12:00').split(':').map(Number);const di=(Date.UTC(YEAR,mo,Math.min(d,$('sDay').options.length))-T0)/DAY;stopPlay();setTime(axisToUtc(di,h*60+m))}
['sMonth','sDay','sTime'].forEach(i=>$(i).addEventListener('change',fromControls));
function jumpNow(){const n=new Date();stopPlay();setTime(Date.UTC(YEAR,n.getMonth(),n.getDate(),n.getHours(),n.getMinutes())+n.getTimezoneOffset()*6e4)}
$('bNow').onclick=jumpNow;
EVENTS.forEach((e,i)=>{$('j'+i).title=`${YEAR} 年${e.n}`;$('j'+i).onclick=()=>{const a=axisParts(S.ms),t=axisParts(e.ms);stopPlay();setTime(axisToUtc(t.doy,a.h*60+a.m))}});
function setMode(m){S.mode=m;[['mDay','day'],['mAct','act'],['mLen','len']].forEach(([id,k])=>$(id).setAttribute('aria-pressed',String(k===m)));dirty.time=true}
$('mDay').onclick=()=>setMode('day');$('mAct').onclick=()=>setMode('act');$('mLen').onclick=()=>setMode('len');
function stopPlay(){S.play=null;$('pDay').setAttribute('aria-pressed','false');$('pYear').setAttribute('aria-pressed','false');$('pDay').textContent='播放一天';$('pYear').textContent='播放一年'}
function togglePlay(k){const was=S.play;stopPlay();if(was!==k){S.play=k;const b=$(k==='day'?'pDay':'pYear');b.setAttribute('aria-pressed','true');b.textContent='暂停'}}
$('pDay').onclick=()=>togglePlay('day');$('pYear').onclick=()=>togglePlay('year');
const list=$('cityList');CITIES.forEach(c=>{const o=document.createElement('option');o.value=`${c.z} · ${c.cn.z}`;list.appendChild(o)});
$('q').addEventListener('change',e=>{const v=e.target.value.trim(),c=CITIES.find(x=>`${x.z} · ${x.cn.z}`===v)||CITIES.find(x=>x.z===v)||CITIES.find(x=>x.z.includes(v)||x.e.toLowerCase()===v.toLowerCase());if(c){pin(c);fly(c);e.target.value='';e.target.blur()}});
function pin(c){S.pin=c;S.hover=null;heatKey='';dirty.time=true;ribKey='';}
let tween=null;
function fly(c){const lon1=c.lo,lat1=Math.max(-55,Math.min(62,c.la));if(reduced){S.lon0=lon1;S.lat0=lat1;dirty.view=true;return}const a={lon:S.lon0,lat:S.lat0},t0=performance.now(),dl=((lon1-a.lon+540)%360)-180;tween=t=>{const u=Math.min(1,(t-t0)/700),e=u*u*(3-2*u);S.lon0=a.lon+dl*e;S.lat0=a.lat+(lat1-a.lat)*e;dirty.view=true;if(u>=1)tween=null}}

{const eg=['Tokyo','New York','London','Delhi','São Paulo','Lagos','Cairo','Moscow'];$('cQuick').innerHTML=eg.map(e=>{const c=CITIES.find(x=>x.e===e);return`<button type="button" data-i="${c.i}">${c.z}</button>`}).join('');$('cQuick').addEventListener('click',e=>{const i=e.target.dataset.i;if(i!==undefined){pin(CITIES[+i]);fly(CITIES[+i])}})}
/* ---------- pointer on the globe ---------- */
let drag=null,lastTap=0;
function pick(px,py){const M=rotMat();let best=null,bd=1e9;for(const c of CITIES){const p=project(c,M);if(p.z<.05)continue;const d=Math.hypot(p.sx-px,p.sy-py)-(4-c.tier)*1.2;if(d<bd){bd=d;best=c}}return bd<13?best:null}
function evp(e){const r=ovc.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}
ovc.addEventListener('pointerdown',e=>{const[x,y]=evp(e);drag={x,y,lon:S.lon0,lat:S.lat0,moved:0,id:e.pointerId};try{ovc.setPointerCapture(e.pointerId)}catch(_){}ovc.classList.add('drag')});
ovc.addEventListener('pointermove',e=>{const[x,y]=evp(e);if(drag){const dx=x-drag.x,dy=y-drag.y;drag.moved=Math.max(drag.moved,Math.abs(dx)+Math.abs(dy));const r=radius()*RAD;S.lon0=drag.lon-dx/r;S.lat0=Math.max(-80,Math.min(80,drag.lat+dy/r));dirty.view=true}
 else if(e.pointerType==='mouse'){const c=pick(x,y);if(c!==S.hover){S.hover=c;ovc.classList.toggle('hit',!!c);dirty.card=true;dirty.view=true}}});
function endDrag(e){if(!drag)return;const[x,y]=evp(e),moved=drag.moved;drag=null;ovc.classList.remove('drag');if(moved<6){const c=pick(x,y);if(c){pin(S.pin===c?null:c);if(e.pointerType!=='mouse')fly(c)}else if(e.pointerType!=='mouse'&&S.pin){/* keep */}}}
ovc.addEventListener('pointerup',endDrag);ovc.addEventListener('pointercancel',()=>{drag=null;ovc.classList.remove('drag')});
ovc.addEventListener('pointerleave',()=>{if(S.hover){S.hover=null;dirty.card=true;dirty.view=true;ovc.classList.remove('hit')}});
ovc.addEventListener('wheel',e=>{if(innerWidth<=1180&&!e.ctrlKey)return;e.preventDefault();S.zoom=Math.max(1,Math.min(7,S.zoom*Math.exp(-e.deltaY*.0012)));dirty.view=true},{passive:false});
addEventListener('keydown',e=>{if(e.key==='Escape'&&S.pin&&!$('notes').open)pin(null)});
new ResizeObserver(resize).observe(stage);

/* ---------- loop ---------- */
let lastStats=0,lastT=performance.now();
function frame(t){const dt=Math.min(.1,(t-lastT)/1000);lastT=t;
 if(tween)tween(t);
 if(S.play==='day')setTime(S.ms+dt*36e5*1.2);else if(S.play==='year')setTime(S.ms+dt*DAY*9);
 if(dirty.time&&t-lastStats>110){lastStats=t;dirty.time=false;recomputeWorld();renderWorld();renderClock();renderCard();drawChart();dirty.view=true}
 else if(dirty.card){dirty.card=false;renderCard()}
 if(dirty.view){dirty.view=false;draw()}
 requestAnimationFrame(frame)}

/* ---------- boot ---------- */
fillMonth();
try{if(gl)initGL();else $('nogl').hidden=false}catch(err){console.error(err);$('nogl').hidden=false}
if(!gl)G.zd=null;
{const off=viewerOff(S.ms);const top=CITIES.filter(c=>c.tier===1).map(c=>[Math.abs(tzOffsetMin(c.tz,S.ms)-off),c]).sort((a,b)=>a[0]-b[0]||b[1].p-a[1].p)[0][1];S.pin=top;S.lon0=top.lo-6;S.lat0=Math.max(-40,Math.min(45,top.la*.7))}
$('notes').innerHTML=document.getElementById('notesT').innerHTML;
$('notes').addEventListener('click',e=>{if(e.target.id==='closeNotes'||e.target===$('notes'))$('notes').close()});
{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);daylightPx=x.getImageData(0,0,im.width,im.height).data;heatKey='';dirty.time=true};im.src='data:image/png;base64,'+B.dayl}
resize();sizeRibbon();requestAnimationFrame(frame);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{dirty.time=true;dirty.view=true});
window.__atlas={S,CITIES,pin,fly,setTime,setMode,stat,EVENTS,screen:c=>project(c,rotMat())};
