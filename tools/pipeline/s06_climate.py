import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from paths import RAW,OUT
import json, math, re, unicodedata, collections, geonamescache
def hav(a,b,c,d):
    p=math.pi/180; h=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*6371*math.asin(math.sqrt(h))
def norm(s): return re.sub(r'[^a-z]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
st=json.load(open(f'{OUT}/stage4.json')); L=st['L']
gc=geonamescache.GeonamesCache(min_city_population=15000)
ne=[f['properties'] for f in json.load(open(f'{RAW}/ne_places.geojson'))['features']]
gidx=collections.defaultdict(list)
for x in gc.get_cities().values():
    gidx[(x['countrycode'],norm(x['name']))].append(x)
    for alt in x.get('alternatenames',[]):
        if alt.isascii(): gidx[(x['countrycode'],norm(alt))].append(x)
rows=[]
for ln in open(f'{OUT}/climate_rows.txt',encoding='utf8'):
    if ln.startswith('#') or not ln.strip(): continue
    iso,name,vals,src=ln.strip().split('|'); r=dict(iso=iso,name=name,t=[int(v) for v in vals.split()],src=src)
    q=gidx.get((iso,norm(name)),[])
    if q: b=max(q,key=lambda x:x['population']); r['lat'],r['lon']=b['latitude'],b['longitude']
    else:
        qq=[p for p in ne if norm(p['NAME'])==norm(name) and p.get('ISO_A2')==iso] or [p for p in ne if norm(p['NAME'])==norm(name)]
        if qq: r['lat'],r['lon']=qq[0]['LATITUDE'],qq[0]['LONGITUDE']
        else: print('no coords',iso,name); continue
    rows.append(r)
# de-duplicate same station, keep the first
seen=set(); R=[]
for r in rows:
    k=(r['iso'],norm(r['name']))
    if k in seen: continue
    seen.add(k); R.append(r)
rows=R; print(len(rows))
miss=[];lim=320; lvl=collections.Counter()
for c in L:
    best=min(rows,key=lambda r:hav(c['lat'],c['lon'],r['lat'],r['lon'])); d=hav(c['lat'],c['lon'],best['lat'],best['lon'])
    c['clim']=rows.index(best); c['cd']=round(d)
    if d>lim: c['clim']=-1; miss.append(c['zh'])
    lvl['exact' if d<40 else 'near' if d<=lim else 'none']+=1
print(lvl,'missing',miss)
for c in L:
    if c['zh'] in ('东京','上海','班加罗尔','马德里','圣地亚哥','纽约','伦敦','开普敦','悉尼'): print(c['zh'],rows[c['clim']]['name'] if c['clim']>=0 else None,c['cd'],rows[c['clim']]['t'] if c['clim']>=0 else None)
json.dump(rows,open(f'{OUT}/climate.json','w'),ensure_ascii=False)
st['L']=L; json.dump(st,open(f'{OUT}/stage4.json','w'),ensure_ascii=False)
