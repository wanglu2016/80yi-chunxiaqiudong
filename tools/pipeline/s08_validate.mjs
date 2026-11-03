import fs from 'fs';import vm from 'vm';import path from 'path';import {fileURLToPath} from 'url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const code=fs.readFileSync(HERE+'/../site/model.js','utf8');
const B=JSON.parse(fs.readFileSync(HERE+'/data/bundle.json','utf8'));
const ctx={Math,Date,Float32Array,Float64Array,Map,Object,console};vm.createContext(ctx);vm.runInContext(code+';this.M={evalPlace,groupShares,ACT,GROUP};',ctx);const M=ctx.M;
const ms0=Date.UTC(2026,0,1),tzOf=n=>B.T.find(t=>t[0]===n);
function yearAvg(a,tzn,la,lo,keep){const cn=B.C.find(c=>c.a===a),tz=tzOf(tzn),S=M.groupShares(cn,false),sh=Object.fromEntries(M.GROUP.map(g=>[g,keep.includes(g)?S[g]:0]));const t=new Float64Array(7);let n=0;
 for(let d=3;d<365;d+=7*3+1)for(let w=0;w<7;w++)for(let q=0;q<24;q++){const r=M.evalPlace(B,cn,tz,la,lo,ms0+(d+w)*864e5+q*36e5,0,null,'v'+a,false,sh);for(let k=0;k<7;k++)t[k]+=r.act[k];n++}
 return [...t].map(v=>v/n*24)}
const ad=['college','office','shift','flex','home','senior'],wa=['college','office','shift','flex','home'];
const us=yearAvg('USA','America/New_York',40.7,-74,ad),cn=yearAvg('CHN','Asia/Shanghai',31.2,121.5,ad);
const jp=yearAvg('JPN','Asia/Tokyo',35.7,139.7,wa),de=yearAvg('DEU','Europe/Berlin',52.5,13.4,wa),kr=yearAvg('KOR','Asia/Seoul',37.6,127,wa),fr=yearAvg('FRA','Europe/Paris',48.9,2.3,wa);
let W=0;const g=new Float64Array(7);
for(const[i,z]of B.Z.entries()){const c=B.C[z[0]],tz=B.T[z[1]];for(let d=10;d<365;d+=73)for(let q=0;q<24;q++){const r=M.evalPlace(B,c,tz,25,tz[1]/4,ms0+d*864e5+q*36e5,0,null,'zv'+i,false);for(let k=0;k<7;k++)g[k]+=r.act[k]*z[2];W+=z[2]}}
const gl=[...g].map(v=>v/W*24);
const f=v=>v.toFixed(1);
const rows=[['全球，全年龄','睡觉和躺床',f(gl[0]),'9.1','The global human day'],['全球，全年龄','工作',f(gl[1]),'2.6','The global human day'],['全球，全年龄','上学学习',f(gl[2]),'1.1','The global human day'],
['美国，15 岁以上','睡觉',f(us[0]),'9.0','ATUS 2025'],['美国，15 岁以上','休闲',f(us[6]),'5.2','ATUS 2025'],
['中国，成年人','睡觉+吃饭洗漱',f(cn[0]+cn[4]),'11.9','2018 调查，生理必需活动'],['中国，成年人','工作',f(cn[1]),'4.4','2018 调查'],['中国，成年人','家务照料',f(cn[5]),'2.7','2018 调查，无酬劳动'],
['日本，15–64 岁','工作、学习和通勤',f(jp[1]+jp[2]+jp[3]*.8),'6.1','OECD / JILPT，2021'],['韩国，15–64 岁','工作、学习和通勤',f(kr[1]+kr[2]+kr[3]*.8),'5.7','OECD / JILPT，2014'],['德国，15–64 岁','工作、学习和通勤',f(de[1]+de[2]+de[3]*.8),'4.1','OECD / JILPT，2012/13'],['法国，15–64 岁','工作、学习和通勤',f(fr[1]+fr[2]+fr[3]*.8),'3.4','OECD / JILPT，2009/10']];
const html='<table><tr><th>对象</th><th>活动</th><th class="num">模型</th><th class="num">调查</th><th>调查来源</th></tr>'+rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td>${r[4]}</td></tr>`).join('')+'</table>';
fs.writeFileSync(HERE+'/data/validation.html',html);console.log(rows.map(r=>r.join(' | ')).join('\n'));
