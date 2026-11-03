/* Rhythm model: pure functions. Everything here is an estimate except sun geometry. */
const ACT=['sleep','work','school','travel','meal','chores','leisure'];
const GROUP=['infant','pupil','college','office','shift','flex','home','senior'];
const A={sleep:0,work:1,school:2,travel:3,meal:4,chores:5,leisure:6};
function mix(o){const v=new Float32Array(7);for(const k in o)v[A[k]]=o[k];return v}
const MX={sleep:mix({sleep:1}),jobs:mix({work:.875,leisure:.07,meal:.04,travel:.015}),routine:mix({meal:.72,chores:.2,leisure:.08}),commute:mix({travel:.94,leisure:.06}),work:mix({work:1}),
 eveHome:mix({chores:.38,leisure:.52,meal:.1}),dinner:mix({meal:.84,chores:.16}),evening:mix({leisure:.72,chores:.22,work:.06}),
 offAm:mix({leisure:.36,chores:.48,travel:.16}),offPm:mix({leisure:.54,chores:.28,travel:.18}),
 school:mix({school:1}),schoolLunch:mix({meal:.7,leisure:.3}),afterSchool:mix({leisure:.55,school:.34,meal:.06,chores:.05}),
 homeAm:mix({chores:.5,leisure:.34,travel:.16}),homePm:mix({leisure:.5,chores:.34,travel:.16}),cook:mix({chores:.8,meal:.2}),
 senAm:mix({leisure:.54,chores:.3,travel:.16}),senPm:mix({leisure:.7,chores:.17,travel:.13}),senEve:mix({leisure:.9,chores:.1}),
 babyPlay:mix({leisure:.74,meal:.26}),babyCare:mix({school:1}),lunchHome:mix({meal:.72,chores:.2,leisure:.08}),flexLunch:mix({meal:.45,work:.55}),
 suhoor:mix({meal:.8,chores:.2})};
function lunchMix(nap){const v=new Float32Array(7);v[A.meal]=.62*(1-nap);v[A.leisure]=.38*(1-nap);v[A.sleep]=nap;return v}

const LOG_K=1.8138; // logistic scale from sd: s=sd*sqrt(3)/pi => sd/1.8138
function F(x,s){const z=x*LOG_K/s;return z>30?1:z<-30?0:1/(1+Math.exp(-z))}
/* A template = ordered [t, sd, mix]; before first and after last the person sleeps. */
function monotone(T){for(let i=1;i<T.length;i++)if(T[i][0]<T[i-1][0]+.2)T[i][0]=T[i-1][0]+.2;return T}
function evalTemplate(T,h,out,wgt){
 const n=T.length,anc=(T[0][0]+T[n-1][0])/2;let x=h;while(x<anc-12)x+=24;while(x>=anc+12)x-=24;
 let prev=F(x-T[0][0],T[0][1]),tot=0;const pAsleep0=1-prev;
 const P=evalTemplate._p.length>=n?evalTemplate._p:(evalTemplate._p=new Float64Array(n+4));
 for(let i=0;i<n;i++){const nx=i+1<n?F(x-T[i+1][0],T[i+1][1]):0;const p=Math.max(0,prev-nx);P[i]=p;tot+=p;prev=nx}
 const sl=pAsleep0+0;const lastF=F(x-T[n-1][0],T[n-1][1]);
 // last segment is the bedtime marker: its probability is the "after bed" sleep share
 const sum=tot+sl;if(sum<=0){out[0]+=wgt;return}
 for(let i=0;i<n;i++){const p=P[i]/sum*wgt;if(p===0)continue;const m=T[i][2];for(let k=0;k<7;k++)if(m[k])out[k]+=m[k]*p}
 out[0]+=sl/sum*wgt;
}
evalTemplate._p=new Float64Array(24);

function officeDay(c,nap){const{w,b,ws,we,l,ll,d,dl}=c,k=c.comm;
 return monotone([[w,.45,MX.routine],[ws-k,.5,MX.commute],[ws,.55,MX.jobs],[l,.28,lunchMix(nap)],[l+ll,.28,MX.jobs],[we,.7,MX.commute],[we+k,.75,MX.eveHome],[d,.5,MX.dinner],[d+dl,.4,MX.evening],[b-.35,.6,MX.sleep]])}
function offDay(c,nap){const{w,b,l,ll,d,dl}=c;const w2=w+.5+1.1*c.xs;
 return monotone([[w2,.8,MX.routine],[w2+.85,.7,MX.offAm],[l+.25,.5,MX.lunchHome],[l+.25+ll,.5,nap?mixNap(MX.offPm,nap):MX.offPm],[d-.1,.6,MX.dinner],[d+dl,.45,MX.evening],[b+.3,.65,MX.sleep]])}
function mixNap(m,nap){const v=m.slice();const q=nap*.45;for(let i=0;i<7;i++)v[i]*=1-q;v[0]+=q;return v}
function fastDay(c,nap,kind){ // Ramadan day for working or home adults
 const{w,b,ws,we,sr,ss}=c,k=c.comm,s=sr-1.55,sback=sr-.75,w2=Math.max(w+.55,sr+.3);
 const end=kind==='work'?ws+.4+Math.max(5.5,(we-ws)-2.2):ss-2;
 const T=[[s,.35,MX.suhoor],[sback,.3,MX.sleep]];
 if(kind==='work')T.push([w2,.4,MX.routine],[ws+.4-k,.5,MX.commute],[ws+.4,.55,MX.jobs],[end,.6,MX.commute],[end+k,.6,MX.offPm]);
 else T.push([w2+.3,.6,MX.homeAm],[ss-3,.5,mixNap(MX.homePm,.35)]);
 T.push([ss-1.2,.45,MX.cook],[ss+.02,.18,MX.dinner],[ss+.8,.35,mix({leisure:.8,chores:.1,meal:.1})],[b+1.5,.7,MX.sleep]);
 return monotone(T)}
function flexDay(c){const{w,b,l,ll,d,dl}=c,k=c.comm*.55,ws=c.ws-.4,we=c.we+1.4;
 return monotone([[w-.15,.6,MX.routine],[ws-k,.9,MX.commute],[ws,1.05,MX.jobs],[l,.45,MX.flexLunch],[l+ll,.45,MX.jobs],[we,1.35,MX.commute],[we+k,1.2,MX.eveHome],[Math.max(d,we+k+.2),.6,MX.dinner],[Math.max(d,we+k+.2)+dl,.4,MX.evening],[b+.2,.7,MX.sleep]])}
function shiftEarly(c){const k=c.comm;return monotone([[4.7,.35,MX.routine],[6-k,.25,MX.commute],[6,.25,MX.jobs],[10.2,.25,lunchMix(0)],[10.6,.25,MX.jobs],[14,.3,MX.commute],[14+k,.3,mixNap(MX.offPm,.5)],[c.d-.2,.5,MX.dinner],[c.d+c.dl,.4,MX.evening],[21.8,.5,MX.sleep]])}
function shiftLate(c){const k=c.comm;return monotone([[8.6,.7,MX.routine],[9.5,.6,MX.offAm],[12.2,.4,MX.lunchHome],[13.4-k+.2,.3,MX.commute],[14,.25,MX.jobs],[18,.3,lunchMix(0)],[18.5,.3,MX.jobs],[22,.3,MX.commute],[22+k,.35,MX.evening],[24.3,.55,MX.sleep]])}
function shiftNight(c){const k=c.comm;return monotone([[15,.7,MX.routine],[16,.6,MX.offPm],[19,.45,MX.dinner],[19.8,.4,MX.evening],[22-k,.3,MX.commute],[22,.25,MX.jobs],[26,.35,lunchMix(0)],[26.5,.35,MX.jobs],[30,.3,MX.commute],[30+k,.3,MX.routine],[32,.5,MX.sleep]])}
function pupilDay(c){const{ss,se,d,dl}=c.P0;const w=ss-1.05,b=Math.min(c.b-.9,22.6);const lun=c.P0.l<12.2?12:Math.min(c.P0.l,13.2);
 const T=[[w,.35,MX.routine],[ss-.42,.22,MX.commute],[ss,.15,MX.school]];
 if(se>lun+.6)T.push([lun,.2,MX.schoolLunch],[lun+.65,.2,MX.school]);
 const eve=c.eve;const home=mix({leisure:.62-.3*eve,school:.26+.42*eve,meal:.06,chores:.06});
 const night=mix({leisure:.84-.62*eve,school:.1+.62*eve,chores:.06});
 const dd=Math.max(d,se+.8);
 T.push([se,.3,MX.commute],[se+.45,.35,home],[dd,.45,MX.dinner],[dd+dl,.35,night],[Math.max(b,dd+dl+1),.5,MX.sleep]);return monotone(T)}
function pupilOff(c){const{l,d,dl}=c,b=Math.min(c.b-.3,23.4),w=c.P0.ss-.1;
 return monotone([[w,.8,MX.routine],[w+.9,.7,mix({leisure:.68,school:.14,chores:.04,travel:.14})],[l+.2,.45,MX.lunchHome],[l+.2+ll0(c),.45,mix({leisure:.72,school:.12,travel:.16})],[d,.5,MX.dinner],[d+dl,.4,mix({leisure:.92,chores:.08})],[b,.6,MX.sleep]])}
function ll0(c){return c.ll}
function collegeDay(c){const{l,d,dl}=c,w=c.w+1.05,k=c.comm*.55,b=c.b+.75;
 const st=mix({school:.86,leisure:.14}),eve=mix({leisure:.6,school:.32,chores:.08});
 return monotone([[w,.75,MX.routine],[9.1-k,.75,MX.commute],[9.1,.9,st],[l,.4,MX.schoolLunch],[l+.8,.4,st],[16.7,1.2,MX.commute],[17.2,1,eve],[Math.max(d,17.8),.7,MX.dinner],[Math.max(d,17.8)+dl,.5,eve],[b,.75,MX.sleep]])}
function collegeOff(c){const{l,d,dl}=c,w=c.w+2.0,b=c.b+1;
 return monotone([[w,1,MX.routine],[w+.9,.8,mix({leisure:.66,school:.18,chores:.08,travel:.08})],[l+.5,.6,MX.lunchHome],[l+1.2,.6,mix({leisure:.66,school:.14,travel:.2})],[d+.2,.7,MX.dinner],[d+.2+dl,.5,mix({leisure:.88,school:.06,chores:.06})],[b,.8,MX.sleep]])}
function babyDay(c,care){const b=Math.min(c.b-1.9,21.3),w=Math.min(c.w+.7,7.6),{l}=c;const nap=Math.min(l+.9,13.6);
 const T=[[w,.6,MX.babyPlay]];
 if(care)T.push([c.P0.ss+.5,.4,MX.babyCare]);
 T.push([Math.min(l,12.2),.4,mix({meal:.8,leisure:.2})],[nap,.45,MX.sleep],[nap+1.75,.5,care?MX.babyCare:MX.babyPlay]);
 if(care)T.push([16.4,.5,MX.babyPlay]);
 T.push([Math.max(c.d-.4,17.3),.55,mix({meal:.72,leisure:.28})],[Math.max(c.d-.4,17.3)+.9,.4,MX.babyPlay],[b,.55,MX.sleep]);return monotone(T)}
function homeDay(c,nap){const{w,b,l,ll,d,dl}=c,w2=w+.25+1.05*c.xs;
 return monotone([[w2,.65,mix({meal:.45,chores:.5,leisure:.05})],[w2+1.0,.6,MX.homeAm],[l-.55,.4,MX.cook],[l+.1,.4,MX.lunchHome],[l+.1+ll,.4,mixNap(MX.homePm,nap)],[d-.9,.5,MX.cook],[d,.45,MX.dinner],[d+dl,.4,mix({leisure:.74,chores:.26})],[b+.1,.65,MX.sleep]])}
function seniorDay(c,nap){const{w,b,l,ll,d,dl}=c,w2=w+.05+.65*c.xs;
 return monotone([[w2,.7,mix({meal:.45,chores:.25,leisure:.3})],[w2+1.0,.7,MX.senAm],[l,.45,MX.lunchHome],[l+ll,.45,mixNap(MX.senPm,Math.min(.75,nap+.3))],[d-.2,.5,MX.dinner],[d-.2+dl,.45,MX.senEve],[b-.3-.5*c.xs,.75,MX.sleep]])}

/* calendar helpers */
function tzOffsetMin(tz,ms){const m=ms/60000;let o=tz[1];const tr=tz[2];for(let i=0;i<tr.length;i++){if(m>=tr[i][0])o=tr[i][1];else break}return o}
function localParts(tz,ms){const o=tzOffsetMin(tz,ms);const d=new Date(ms+o*60000);return{o,y:d.getUTCFullYear(),mo:d.getUTCMonth(),d:d.getUTCDate(),dow:d.getUTCDay(),h:d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600}}
const pad=n=>(n<10?'0':'')+n;
const md=(mo,d)=>pad(mo+1)+'-'+pad(d);
function inRanges(s,R){for(const[a,b]of R){if(a<=b?(s>=a&&s<=b):(s>=a||s<=b))return true}return false}
const RAMADAN=[Date.UTC(2026,1,19),Date.UTC(2026,2,19)]; // first and last full fasting day, ±1 day by country
/* solar */
function sunVec(ms){const n=ms/86400000+2440587.5-2451545.0,rad=Math.PI/180;
 const L0=((280.46646+.9856474*n)%360+360)%360,g=(((357.52911+.98560028*n)%360)+360)%360*rad;
 const C=1.914602*Math.sin(g)+.019993*Math.sin(2*g)+.000289*Math.sin(3*g),lam=(L0+C)*rad,eps=(23.43929-.00000036*n)*rad;
 const dec=Math.asin(Math.sin(eps)*Math.sin(lam));let ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam))/rad;ra=(ra+360)%360;
 const eot=(((L0-ra+180)%360+360)%360-180)*4;return{dec,eot,lam:((L0+C)%360+360)%360}}
function altitude(lat,lon,ms){const{dec,eot}=sunVec(ms),rad=Math.PI/180,utc=((ms%86400000)+86400000)%86400000/3600000;
 const H=(15*(utc-12+eot/60)+lon)*rad;return Math.asin(Math.sin(lat*rad)*Math.sin(dec)+Math.cos(lat*rad)*Math.cos(dec)*Math.cos(H))/rad}
/* sunrise/sunset local-clock hours for the civil date containing ms at this place; h0 in degrees */
function sunTimes(lat,lon,localMidnightUtcMs,offMin,h0=-.833){const rad=Math.PI/180;
 const noon=localMidnightUtcMs+12*3600000,{dec,eot}=sunVec(noon);
 const c=(Math.sin(h0*rad)-Math.sin(lat*rad)*Math.sin(dec))/(Math.cos(lat*rad)*Math.cos(dec));
 const tn=12-lon/15-eot/60+offMin/60; // solar noon on the local clock
 if(c>=1)return{polar:'night',noon:tn,len:0,sr:tn,ss:tn};if(c<=-1)return{polar:'day',noon:tn,len:24,sr:tn-12,ss:tn+12};
 const H=Math.acos(c)/rad/15;return{polar:null,noon:tn,len:2*H,sr:tn-H,ss:tn+H}}

/* group shares of a population */
function groupShares(c,urban){const s=c.s,inf=s[0],kid=s[1],yng=s[2],mid=s[3],old=s[4];
 const v0=c.v/100,ag=c.ag/100;const vuln=urban?Math.max(.03,(v0-.85*ag)/Math.max(.2,1-.85*ag)):v0;
 const enrol=Math.min(1,(.6*Math.min(c.prm,100)+.4*Math.min(c.sec,100))/100);
 const pup=kid*enrol,kidOut=kid-pup,col=yng*Math.min(.8,c.ter/100);
 let W=c.a15*c.emp/100;const W1564=(c.a15-old)*(c.acti/100)*(c.emp/c.lfp);
 const oldW=Math.max(0,Math.min(old*.6,W-W1564)),sen=old-oldW;
 const adult=yng-col+mid+kidOut;let wAdult=Math.min(W-oldW,adult*.97),home=adult-wAdult;
 W=wAdult+oldW;
 const flex=W*vuln,shift=(W-flex)*.16,off=W-flex-shift;
 return{infant:inf,pupil:pup,college:col,office:off,shift,flex,home,senior:sen,vuln}}

/* day context for a place */
function dayCtx(B,cn,tz,lat,lon,ms,tier,temp){
 const lp=localParts(tz,ms),key=md(lp.mo,lp.d);
 const midnight=Date.UTC(lp.y,lp.mo,lp.d)-lp.o*60000;
 const st=sunTimes(lat,lon,midnight,lp.o);
 const P0=Object.assign({},B.P[cn.f],cn.o||{});
 const hn=cn.h[key];const isHol=hn!==undefined&&!(cn.mk&&cn.mk.includes(key));
 let wkEnd=cn.wk.includes(lp.dow);if(cn.mk&&cn.mk.includes(key))wkEnd=false;
 const isSecond=wkEnd&&cn.wk.length>1&&cn.wk[1]===lp.dow;
 const sbreak=inRanges(key,B.SCHOOL[cn.sc]);
 const schoolDay=!wkEnd&&!isHol&&!sbreak;
 const night=24-(st.polar==='day'?24:st.polar==='night'?0:st.len);
 const e=Math.max(-.4,Math.min(.4,.12*(night-12)));
 const comm=(tier===1?.72:tier===2?.6:tier===3?.48:tier===4?.38:.44)*P0.c;
 const w=P0.w+e*.5,b=P0.b-e*.5;
 const dayUTC=Date.UTC(lp.y,lp.mo,lp.d);
 const ram=cn.r&&dayUTC>=RAMADAN[0]&&dayUTC<=RAMADAN[1]?cn.r:0;
 const ct=Object.assign({},P0,{P0,w,b,comm,xs:P0.xs==null?1.2:P0.xs,eve:P0.eve,sr:st.polar?6:st.sr,ss:st.polar?18:st.ss});
 const hot=temp==null?0:Math.max(0,Math.min(1,(temp-22)/10));
 const nap=Math.min(.45,P0.nap*(1+hot*.8));
 let wd=P0.wd||.84;if(wkEnd)wd=isSecond?P0.sun:P0.sat;
 if(isHol)wd=Math.min(wd,.14);
 let fx=wkEnd?(isSecond?.55:.7):.9;if(isHol)fx=.55;
 let sh=wkEnd?.62:.74;if(isHol)sh=.58;
 return{lp,key,st,ct,nap,wd,fx,sh,schoolDay,sbreak,wkEnd,isHol,hn,ram,e,midnight,temp}}

function monthTemp(t,lp){if(!t)return null;const f=(lp.mo+(lp.d-15)/30.4+12)%12,i=Math.floor(f),u=f-i;return t[i]*(1-u)+t[(i+1)%12]*u}

const _tcache=new Map();
function templates(dc,cn,cc){ // cached per place/day
 const k=cc+'|'+dc.key+'|'+dc.nap.toFixed(3);let v=_tcache.get(k);if(v)return v;if(_tcache.size>4000)_tcache.clear();
 const c=dc.ct,nap=dc.nap,r=dc.ram;
 v={office:[officeDay(c,nap),offDay(c,nap)],shift:[shiftEarly(c),shiftLate(c),shiftNight(c),offDay(c,nap)],flex:[flexDay(c),offDay(c,nap)],
    pupil:[pupilDay(c),pupilOff(c)],college:[collegeDay(c),collegeOff(c)],infant:[babyDay(c,true),babyDay(c,false)],home:[homeDay(c,nap)],senior:[seniorDay(c,nap)]};
 if(r){v.fastW=fastDay(c,nap,'work');v.fastH=fastDay(c,nap,'home')}
 _tcache.set(k,v);return v}

function groupAct(g,dc,T,h,cn,out){out.fill(0);const r=dc.ram;
 const att=Math.min(.95,cn.pre/100)*.5;
 switch(g){
  case'office':{const a=dc.wd,f=r?r:0;
   if(f){evalTemplate(T.fastW,h,out,a*f);evalTemplate(T.office[0],h,out,a*(1-f));evalTemplate(T.office[1],h,out,1-a)}
   else{evalTemplate(T.office[0],h,out,a);evalTemplate(T.office[1],h,out,1-a)}break}
  case'shift':{const a=dc.sh;evalTemplate(T.shift[0],h,out,a*.3);evalTemplate(T.shift[1],h,out,a*.35);evalTemplate(T.shift[2],h,out,a*.35);evalTemplate(T.shift[3],h,out,1-a);break}
  case'flex':{const a=dc.fx,f=r?r*.8:0;if(f)evalTemplate(T.fastW,h,out,a*f);evalTemplate(T.flex[0],h,out,a*(1-f));evalTemplate(T.flex[1],h,out,1-a);break}
  case'pupil':if(dc.schoolDay)evalTemplate(T.pupil[0],h,out,1);else evalTemplate(T.pupil[1],h,out,1);break;
  case'college':if(dc.schoolDay){evalTemplate(T.college[0],h,out,.7);evalTemplate(T.college[1],h,out,.3)}else evalTemplate(T.college[1],h,out,1);break;
  case'infant':{const a=dc.schoolDay?att:0;if(a)evalTemplate(T.infant[0],h,out,a);evalTemplate(T.infant[1],h,out,1-a);break}
  case'home':{const f=r?r:0;if(f)evalTemplate(T.fastH,h,out,f);evalTemplate(T.home[0],h,out,1-f);break}
  case'senior':{const f=r?r*.6:0;if(f)evalTemplate(T.fastH,h,out,f);evalTemplate(T.senior[0],h,out,1-f);break}
 }}

/* full city/zone evaluation at instant ms */
const _g=new Float64Array(7);
const _dcache=new Map();
function dayCached(B,cn,tz,lat,lon,ms,tier,tempArr,ck){const lp=localParts(tz,ms),k=ck+'|'+lp.mo+'-'+lp.d;let dc=_dcache.get(k);
 if(!dc){if(_dcache.size>6000)_dcache.clear();dc=dayCtx(B,cn,tz,lat,lon,ms,tier,monthTemp(tempArr,lp));_dcache.set(k,dc)}return{dc,lp}}
function evalPlace(B,cn,tz,lat,lon,ms,tier,tempArr,cacheKey,urban,shares){
 const{dc,lp}=dayCached(B,cn,tz,lat,lon,ms,tier,tempArr,cacheKey),h=lp.h;
 // hours after midnight still belong to the previous day's routine
 const yesterday=h<4?dayCached(B,cn,tz,lat,lon,ms-864e5,tier,tempArr,cacheKey).dc:null;
 const use=yesterday||dc;
 const S=shares||groupShares(cn,urban),T=templates(use,cn,cacheKey);
 const res={groups:[],act:new Float64Array(7),dc,lp,S};
 for(const g of GROUP){const sh=S[g],a=new Float64Array(7);groupAct(g,use,T,h,cn,a);
  let t=0;for(let k=0;k<7;k++)t+=a[k];if(t>0)for(let k=0;k<7;k++)a[k]/=t;
  res.groups.push({g,share:sh,act:a});for(let k=0;k<7;k++)res.act[k]+=a[k]*sh}
 let tt=0;for(let k=0;k<7;k++)tt+=res.act[k];if(tt>0)for(let k=0;k<7;k++)res.act[k]/=tt;
 return res}
