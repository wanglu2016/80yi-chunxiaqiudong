import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from paths import RAW,OUT
import json, math, collections, random, base64, re, unicodedata, time
import numpy as np, pandas as pd
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from shapely.geometry import shape, Point, LineString
from shapely.strtree import STRtree
from shapely.prepared import prep
from shapely import simplify
from timezonefinder import TimezoneFinder
import geonamescache, holidays
from PIL import Image, ImageDraw
random.seed(2026); rng=np.random.default_rng(2026)
def hav(a,b,c,d):
    p=math.pi/180; h=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*6371*math.asin(math.sqrt(h))
def norm(s): return re.sub(r'[^a-z]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
L=json.load(open(f'{OUT}/cities_final0.json'))
C=pd.read_json(f'{OUT}/countries_raw.json')
ne=[f['properties'] for f in json.load(open(f'{RAW}/ne_places.geojson'))['features']]
# ---- city edits
drop={'New Taipei','Jerusalem','Gaza','Hamilton','Bir Lehlou','The Hague'}
L=[c for c in L if c['en'] not in drop and c['zh']!='新北']
def addne(name,a3,zh=None):
    q=[p for p in ne if p['NAME']==name and p['ADM0_A3'] in (a3,)]
    if not q: print('NE miss',name,a3); return
    p=max(q,key=lambda x:x['POP_MAX']); L.append(dict(en=name,zh=zh or p['NAME_ZH'],a3=a3,lat=p['LATITUDE'],lon=p['LONGITUDE'],pop=float(p['POP_MAX']),src='ne',cap=int(p['ADM0CAP'] or 0),tz=p['TIMEZONE']))
addne('Ramallah','PSX','拉姆安拉'); addne('Laayoune','SAH','阿尤恩')
Z={'美因河畔法兰克福':'法兰克福','奥克兰都会区':'奥克兰','吉布地':'吉布提','圣荷西':'圣何塞','瓜地马拉':'危地马拉城','利雅德':'利雅得','胡志明':'胡志明市','努尔苏丹':'阿斯塔纳','斯里巴加湾':'斯里巴加湾市','培亚':'普拉亚','贝尔墨邦':'贝尔莫潘','圣约翰':'圣约翰斯','华盛顿哥伦比亚特区':'华盛顿','圣米格尔-德-图库曼':'图库曼','摩加迪休':'摩加迪沙','洛美':'洛美','君士坦丁':'君士坦丁','巴斯特尔':'巴斯特尔','金沙萨':'金沙萨'}
for c in L:
    c['zh']=Z.get(c['zh'],c['zh'])
    if c['en']=='Nairobi': c['zh']='内罗毕'
CZ={'中华人民共和国':'中国','中华民国':'中国台湾','香港':'中国香港','澳门':'中国澳门','大韩民国':'韩国','朝鲜民主主义人民共和国':'朝鲜','蒙古国':'蒙古','阿拉伯联合酋长国':'阿联酋','波斯尼亚和黑塞哥维那':'波黑','斯威士兰':'埃斯瓦蒂尼','密克罗尼西亚联邦':'密克罗尼西亚','刚果民主共和国':'刚果（金）','刚果共和国':'刚果（布）','南非共和国':'南非'}
C['zh']=C['zh'].map(lambda z:CZ.get(z,z))
for k in ['emp','lfp','vuln','agr','ser','ter','sec','prm','pre']: pass
# Taiwan not in WDI: DGBAS 2024 headline values (labour force 59.3%, unemployment 3.4%, ag 4.5%); Ministry of Education tertiary GER ~84
for k,v in dict(emp=57.3,lfp=59.3,vuln=15.0,agr=4.5,ser=60.0,ter=84.0,sec=100.0,prm=100.0,pre=90.0).items():
    C.loc[C.a3=='TWN',k]=v
sub=C.groupby('subreg')
for k in ['emp','lfp','vuln','agr','ser','ter','sec','prm','pre','urb']:
    C[k]=C[k].fillna(sub[k].transform('median')).fillna(C[k].median())
ai={a:i for i,a in enumerate(C.a3)}
for c in L:
    if c['a3'] not in ai: print('no country',c)
L=[c for c in L if c['a3'] in ai]
# ---- polygons
admin=json.load(open(f'{RAW}/ne_admin0.geojson'))['features']
MAP={'SOL':'SOM','CYN':'CYP','KAS':'IND','ESB':'GBR','WSB':'GBR','USG':'USA','IOA':'GBR','SSD':'SDS','PSE':'PSX'}
polys=[];pa=[]
for f in admin:
    a=f['properties']['ADM0_A3']; a=MAP.get(a,a)
    if a not in ai: continue
    g=shape(f['geometry']).buffer(0)
    for part in (g.geoms if hasattr(g,'geoms') else [g]):
        polys.append(part); pa.append(a)
print('polys',len(polys),'countries',len(set(pa)),'missing',[a for a in ai if a not in set(pa)][:40])
tree=STRtree(polys); pp=[None]*len(polys)
def locate(lon,lat,maxd=1.0):
    pt=Point(lon,lat)
    for i in tree.query(pt):
        if pp[i] is None: pp[i]=prep(polys[i])
        if pp[i].contains(pt): return pa[i],True
    i=tree.nearest(pt)
    if polys[i].distance(pt)<=maxd: return pa[i],False
    return None,False
# ---- grid
G=json.load(open(f'{RAW}/grid_echarts.json'))
# The grid stores density per unit of LAND, so a tiny island cell has a huge value.
# People in a cell = density x land area in the cell, so weight every cell by its land share.
_W,_H=7200,3600
_img=Image.new('L',(_W,_H),0); _dr=ImageDraw.Draw(_img)
for _p in polys:
    _dr.polygon([((x+180)/360*_W,(90-y)/180*_H) for x,y in _p.exterior.coords],fill=255)
    for _h in _p.interiors: _dr.polygon([((x+180)/360*_W,(90-y)/180*_H) for x,y in _h.coords],fill=0)
_m=np.asarray(_img,dtype=np.float32)/255
def land_share(lo,la):
    x0=int((lo-.25+180)/360*_W); x1=int((lo+.25+180)/360*_W); y0=int((90-la-.25)/180*_H); y1=int((90-la+.25)/180*_H)
    x0=max(0,x0);y0=max(0,y0)
    return float(_m[y0:max(y0+1,y1),x0:max(x0+1,x1)].mean())
cells=collections.defaultdict(list)
t=time.time()
for lo,la,v in G:
    a,_=locate(lo,la)
    if a: cells[a].append((lo,la,v*math.cos(math.radians(la))*max(.01,land_share(lo,la))))
print('grid assigned',sum(len(v) for v in cells.values()),'of',len(G),round(time.time()-t,1),'s')
# ---- geonames towns
gc=geonamescache.GeonamesCache(min_city_population=15000); towns=collections.defaultdict(list)
for x in gc.get_cities().values():
    a,_=locate(x['longitude'],x['latitude'],0.3)
    if a: towns[a].append((x['longitude'],x['latitude'],float(x['population'])))
print('towns',sum(len(v) for v in towns.values()))
# ---- dots
PER=100000.0
dots=[]; zones_pop=collections.Counter()
tf=TimezoneFinder(in_memory=True)
ctz={}
for c in L:
    z=tf.timezone_at(lng=c['lon'],lat=c['lat']) or c['tz']; c['tz']=z
    if c['cap'] or c['a3'] not in ctz: ctz[c['a3']]=z
def jitter(lo,la,km):
    dx=rng.normal(0,km); dy=rng.normal(0,km)
    return lo+dx/(111.32*max(.15,math.cos(math.radians(la)))),la+dy/111.32
stat=[]
for a,i in ai.items():
    P=float(C.loc[i,'pop']); n=round(P/PER)
    if n==0 and P>=30000: n=1
    if n==0: continue
    metros=[c for c in L if c['a3']==a]
    items=[]; mt=0
    for m in metros:
        items.append(('m',m['lon'],m['lat'],m['pop'],8+4.5*math.sqrt(m['pop']/1e6))); mt+=m['pop']
    scale_m=min(1.0,0.85*P/mt) if mt else 1
    items=[(k,x,y,w*scale_m,s) for k,x,y,w,s in items]
    mt*=scale_m
    tw=[]
    for lo,la,p in towns.get(a,[]):
        if any(hav(la,lo,m['lat'],m['lon'])<14+7*math.sqrt(m['pop']/1e6) for m in metros): continue
        tw.append((lo,la,p))
    ts=sum(p for _,_,p in tw); budget=max(0,P-mt)
    ts_scale=min(1.0,0.7*budget/ts) if ts else 0
    for lo,la,p in tw: items.append(('t',lo,la,p*ts_scale,3+3*math.sqrt(p/1e6)))
    rest=max(0,budget-ts*ts_scale); cs=cells.get(a,[]); W=sum(v for *_,v in cs)
    if W>0:
        for lo,la,v in cs: items.append(('c',lo,la,rest*v/W,0))
    elif metros:
        items.append(('m',metros[0]['lon'],metros[0]['lat'],rest,12))
    tot=sum(it[3] for it in items)
    if tot<=0: continue
    random.shuffle(items)
    step=tot/n; acc=random.random()*step; made=0
    idx=[i for i,p in enumerate(polys) if pa[i]==a]
    for k,x,y,w,s in items:
        acc+=w
        while acc>=step and made<n:
            acc-=step; made+=1
            for _ in range(14):
                if k=='c':
                    lo=x+random.random()*.5-.25; la=y+random.random()*.5-.25
                else:
                    lo,la=jitter(x,y,s)
                b,on=locate(lo,la,0.0)
                if on: break
            lo=((lo+180)%360)-180; la=max(-89,min(89,la))
            z=tf.timezone_at(lng=lo,lat=la)
            if z is None or z.startswith('Etc/'): z=ctz.get(a)
            if z is None: z=tf.timezone_at(lng=x,lat=y) or 'UTC'
            dots.append((la,lo,a,z))
    stat.append((a,n,made))
print('dots',len(dots),'short',[s for s in stat if s[1]!=s[2]][:10])
random.shuffle(dots)
tzs=sorted({d[3] for d in dots}|{c['tz'] for c in L})
tzi={t:i for i,t in enumerate(tzs)}
zk={}
for d in dots:
    k=(d[2],d[3]); zk.setdefault(k,len(zk))
zones=[None]*len(zk)
for k,i in zk.items(): zones[i]=[ai[k[0]],tzi[k[1]],0]
ndots=collections.Counter(d[2] for d in dots)
for d in dots: zones[zk[(d[2],d[3])]][2]+=1
# each dot's true weight: country population / dots in that country
la=np.array([round(d[0]*100) for d in dots],dtype=np.int16); lo=np.array([round(d[1]*100) for d in dots],dtype=np.int16); zo=np.array([zk[(d[2],d[3])] for d in dots],dtype=np.uint16)
print('zones',len(zones),'tz',len(tzs))
wt=[float(C.loc[ai[a],'pop'])/ndots[a] for a in sorted(ndots)]
# ---- tz table
tab=[]
t0=datetime(2026,1,1,tzinfo=timezone.utc)-timedelta(days=2)
for name in tzs:
    zi=ZoneInfo(name); prev=None; tr=[]
    for h in range(0,24*370):
        u=t0+timedelta(hours=h); off=int(u.astimezone(zi).utcoffset().total_seconds()/60)
        if prev is None: base=off
        elif off!=prev:
            # refine to minute
            lo_,hi=u-timedelta(hours=1),u
            for m in range(0,61):
                uu=lo_+timedelta(minutes=m)
                if int(uu.astimezone(zi).utcoffset().total_seconds()/60)==off: break
            tr.append([int(uu.timestamp()/60),off])
        prev=off
    tab.append([name,base,tr])
print('dst zones',sum(1 for t in tab if t[2]),tab[tzi.get('Asia/Shanghai')],tab[tzi.get('America/New_York')])
# ---- climate
rows=[]
for ln in open(f'{OUT}/climate_rows.txt',encoding='utf8'):
    if ln.startswith('#') or not ln.strip(): continue
    iso,name,vals,src=ln.strip().split('|'); rows.append(dict(iso=iso,name=name,t=[int(v) for v in vals.split()],src=src))
gidx=collections.defaultdict(list)
for x in gc.get_cities().values():
    gidx[(x['countrycode'],norm(x['name']))].append(x)
    for alt in x.get('alternatenames',[]):
        if alt.isascii(): gidx[(x['countrycode'],norm(alt))].append(x)
for r in rows:
    q=gidx.get((r['iso'],norm(r['name'])),[])
    if not q and r['name']=='Yaounde': q=gidx.get(('CM','yaounde'),[])
    if not q and r['name']=='Malaga': q=gidx.get(('ES','malaga'),[])
    if q:
        b=max(q,key=lambda x:x['population']); r['lat'],r['lon']=b['latitude'],b['longitude']
    else:
        qq=[p for p in ne if norm(p['NAME'])==norm(r['name'])]
        if qq: r['lat'],r['lon']=qq[0]['LATITUDE'],qq[0]['LONGITUDE']
        else: print('no coords',r['iso'],r['name']); r['lat']=None
rows=[r for r in rows if r['lat'] is not None]
nat={'ESP':[9,9,12,14,17,21,23,24,21,17,12,9],'CHL':[18,18,17,14,12,10,9,10,12,13,15,17]}
miss=[]
for c in L:
    best=min(rows,key=lambda r:hav(c['lat'],c['lon'],r['lat'],r['lon'])); d=hav(c['lat'],c['lon'],best['lat'],best['lon'])
    c['clim']=rows.index(best); c['cd']=round(d)
    lim=320
    if d>lim:
        c['clim']=-1; miss.append((c['zh'],c['a3'],best['name'],round(d)))
print('climate none',len(miss),miss)
json.dump(rows,open(f'{OUT}/climate.json','w'),ensure_ascii=False)
json.dump(dict(L=L,tzs=tab,zones=zones),open(f'{OUT}/stage4.json','w'),ensure_ascii=False)
C.to_json(f'{OUT}/countries_stage.json',orient='records',force_ascii=False)
np.savez(f'{OUT}/dots.npz',la=la,lo=lo,zo=zo)
