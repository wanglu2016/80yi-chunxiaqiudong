import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from paths import RAW,OUT
import json, math, collections, pandas as pd
import geonamescache
WUP='''Jakarta|Indonesia|41914
Dhaka|Bangladesh|36585
Tokyo|Japan|33413
Delhi|India|30222
Shanghai|China|29559
Guangzhou|China|27563
Cairo|Egypt|25566
Manila|Philippines|24735
Kolkata|India|22550
Seoul|South Korea|22490
Karachi|Pakistan|21423
Mumbai|India|20203
São Paulo|Brazil|18950
Bangkok|Thailand|18180
Mexico City|Mexico|17734
Beijing|China|17013
Lahore|Pakistan|15156
Istanbul|Turkey|15015
Moscow|Russia|14525
Ho Chi Minh City|Vietnam|14053
Buenos Aires|Argentina|14018
New York|United States of America|13920
Shenzhen|China|13878
Bengaluru|India|13187
Ōsaka|Japan|12964
Lagos|Nigeria|12792
Los Angeles|United States of America|12740
Luanda|Angola|11370
Chennai|India|11153
Kinshasa|Congo (Kinshasa)|10944
Bogota|Colombia|10624
Lima|Peru|10580
London|United Kingdom|10416
Hajipur|India|9942
Rio de Janeiro|Brazil|9500
Paris|France|9382
Hyderabad|India|9191
Tehran|Iran|9175
Taipei|Taiwan|9137
Bandung|Indonesia|8909
Kuala Lumpur|Malaysia|8444
Dar es Salaam|Tanzania|7795
Suzhou|China|7731
Ahmedabad|India|7632
Hangzhou|China|7500
Wuhan|China|7364
Tianjin|China|7285
Alexandria|Egypt|7267
Nagoya|Japan|7146
Johannesburg|South Africa|7077
Chongqing|China|7071
Riyadh|Saudi Arabia|6916
Surat|India|6909
Surabaya|Indonesia|6844
Pune|India|6818
Khartoum|Sudan|6809
Nanjing|China|6801
Santiago|Chile|6726
Addis Ababa|Ethiopia|6706
Abidjan|Ivory Coast|6622
Chaozhou|China|6408
Amman|Jordan|6404
Baghdad|Iraq|6391
Chengdu|China|6140
Nairobi|Kenya|6134
Kozhikode|India|6124
Shenyang|China|5703
Kabul|Afghanistan|5636
Onitsha|Nigeria|5628
Rangoon|Myanmar|5618
Accra|Ghana|5593
Madrid|Spain|5584
Faisalabad|Pakistan|5566
Toronto|Canada|5494
Mashhad|Iran|5398
Dubai|United Arab Emirates|5284
Xian|China|5231
Colombo|Sri Lanka|5224
Yaounde|Cameroon|5106
Kochi|India|5078
Hanoi|Vietnam|5068
Lucknow|India|5052'''
wup=[l.split('|') for l in WUP.splitlines()]
ne=[f['properties'] for f in json.load(open(f'{RAW}/ne_places.geojson'))['features']]
P=pd.DataFrame([{k:p.get(k) for k in ['NAME','NAMEASCII','NAME_ZH','ADM0NAME','SOV0NAME','ADM0_A3','SOV_A3','ADM1NAME','POP_MAX','POP_MIN','LATITUDE','LONGITUDE','ADM0CAP','FEATURECLA','TIMEZONE','RANK_MAX']} for p in ne])
print(P[P.NAME.str.contains('Hajipur|Kozhikode|Calicut|Chaozhou|Onitsha|Kochi|Cochin|Surat|Faisalabad|Rangoon|Yangon|Colombo|Kotte|Xian|Xi.an|Bengaluru|Bangalore')][['NAME','ADM0NAME','POP_MAX','NAME_ZH']].to_string())
print(sorted(P[P.ADM0_A3=='CHN'].sort_values('POP_MAX',ascending=False).NAME.head(70).tolist()))
print(P.ADM0_A3.nunique())
gc=geonamescache.GeonamesCache(min_city_population=15000); c=gc.get_cities(); print(len(c)); v=list(c.values())[:2]; print(v)

# ---------- selection ----------
from opencc import OpenCC
cc=OpenCC('t2s')
C=pd.read_json(f'{OUT}/countries_raw.json')
a3set=set(C.a3)
def hav(a,b,c,d):
    p=math.pi/180; h=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*6371*math.asin(math.sqrt(h))
P=P[~P.FEATURECLA.isin(['Scientific station','Meteorological Station','Historic place'])].copy()
A3MAP={'SOL':'SOM','CYN':'CYP','IOA':None,'KAS':'IND','SSD':'SDS','PSE':'PSX','PSX':'PSX','SDN':'SDN'}
P['a3']=P.ADM0_A3.map(lambda x:A3MAP.get(x,x))
sel={}  # key -> dict
def add(row,src='ne',pop=None,tier_note=None):
    k=(row.NAME,row.a3)
    if k in sel: return sel[k]
    sel[k]=dict(en=row.NAME,zh=row.NAME_ZH,a3=row.a3,lat=float(row.LATITUDE),lon=float(row.LONGITUDE),pop=float(pop if pop else row.POP_MAX),src=src,cap=int(row.ADM0CAP or 0),tz=row.TIMEZONE)
    return sel[k]
fix={'Delhi':('Delhi','IND'),'New York':('New York','USA'),'Suzhou':None}
gcities=list(c.values())
hits=[]
for name,ctry,th in wup:
    q=P[P.NAME==name]
    if name=='Suzhou': q=P[(P.NAME=='Suzhou')&(P.ADM1NAME=='Jiangsu')]
    if name=='Delhi': q=P[(P.NAME.isin(['Delhi','New Delhi']))&(P.ADM0_A3=='IND')].sort_values('POP_MAX',ascending=False)
    if name=='Rangoon': q=P[P.NAME=='Yangon']
    if name=='Shenyang': q=P[P.NAME=='Shenyeng']
    if name=='Bogota': q=P[P.NAME.isin(['Bogota','Bogotá'])]
    if name=='Santiago': q=P[(P.NAME=='Santiago')&(P.ADM0_A3=='CHL')]
    if name=='Hyderabad': q=P[(P.NAME=='Hyderabad')&(P.ADM0_A3=='IND')]
    if name=='Alexandria': q=P[(P.NAME=='Alexandria')&(P.ADM0_A3=='EGY')]
    if name=='Kochi': q=P[(P.NAME=='Kochi')&(P.ADM0_A3=='IND')]
    if name=='Nagoya': q=P[(P.NAME=='Nagoya')&(P.ADM0_A3=='JPN')]
    if len(q)==0:
        hits.append(name); continue
    r=q.sort_values('POP_MAX',ascending=False).iloc[0]
    add(r,'wup',int(th)*1000)
print('not in NE:',hits)
# Hajipur from GeoNames
h=[x for x in gcities if x['name']=='Hājīpur' or x['name']=='Hajipur']; print(h[:1] and {k:h[0][k] for k in ['name','latitude','longitude','population','timezone']})
if h:
    sel[('Hajipur','IND')]=dict(en='Hajipur',zh='哈吉布尔',a3='IND',lat=h[0]['latitude'],lon=h[0]['longitude'],pop=9942000.0,src='wup',cap=0,tz=h[0]['timezone'])
# capitals + largest
for a3,g in P.groupby('a3'):
    if a3 is None or a3 not in a3set: continue
    popc=float(C[C.a3==a3]['pop'].iloc[0])
    caps=g[g.ADM0CAP==1].sort_values('POP_MAX',ascending=False)
    if len(caps): add(caps.iloc[0])
    if popc>=500000:
        add(g.sort_values('POP_MAX',ascending=False).iloc[0])
# every metropolis of 3.5M+ in the places table joins, whatever the UN list says
for r in P[(P.POP_MAX>=3.5e6)].itertuples():
    if r.a3 in a3set and (r.NAME,r.a3) not in sel and r.NAME not in ('New Delhi','Amaravati','Ghaziabad','Sharjah','Xian','Yangon','Rangoon'): add(r)
quota={ # extra tier3, tier4
 'CHN':(0,0),'IND':(7,4),'USA':(10,5),'IDN':(3,2),'PAK':(2,1),'NGA':(3,2),'BRA':(5,3),'BGD':(1,1),'RUS':(6,3),'MEX':(4,2),'JPN':(3,2),'PHL':(2,1),'ETH':(1,1),'EGY':(1,1),'VNM':(2,1),'COD':(2,1),'IRN':(2,1),'TUR':(3,1),'DEU':(4,2),'THA':(1,1),'GBR':(3,2),'TZA':(1,1),'FRA':(3,2),'ZAF':(2,1),'ITA':(3,1),'KEN':(1,1),'KOR':(1,1),'ESP':(2,1),'COL':(2,1),'ARG':(2,2),'CAN':(4,2),'AUS':(3,2),'SAU':(1,1),'UKR':(1,1),'POL':(1,1),'DZA':(1,1),'MAR':(1,1),'IRQ':(1,1),'UZB':(1,0),'PER':(1,1),'MYS':(1,1),'VEN':(1,0),'AGO':(1,0),'CHL':(1,1)}
def extras(a3,n3,n4):
    g=P[P.a3==a3].sort_values('POP_MAX',ascending=False)
    picks=[v for v in sel.values() if v['a3']==a3]
    def far(r,km): return all(hav(r.LATITUDE,r.LONGITUDE,p['lat'],p['lon'])>km for p in picks)
    cnt=0
    for r in g[(g.POP_MAX>=1e6)].itertuples():
        if cnt>=n3: break
        if far(r,260): picks.append(add(r)); cnt+=1
    cnt=0
    for r in g[(g.POP_MAX<9e5)&(g.POP_MAX>=1.2e5)].itertuples():
        if cnt>=n4: break
        if r.FEATURECLA.startswith('Admin-1') and far(r,320): picks.append(add(r)); cnt+=1
for a3,(n3,n4) in quota.items(): extras(a3,n3,n4)
manual={'CHN':['Zhengzhou','Qingdao','Xiamen','Kunming','Harbin','Changsha','Jinan','Dalian','Fuzhou','Ürümqi','Lhasa','Xining','Haikou','Luoyang','Hohhot','Lanzhou'],
 'RUS':['Yakutsk','Murmansk','Vladivostok'],'NOR':['Tromsø'],'ARG':['Ushuaia'],'USA':['Anchorage','Honolulu','Fairbanks'],'ISL':['Reykjavík'],'CAN':['Iqaluit'],'CHL':['Punta Arenas'],'AUS':['Darwin'],'NZL':['Auckland','Wellington'],'FIN':['Rovaniemi'],'IND':['Varanasi','Srinagar','Guwahati','Jaipur'],'JPN':['Sapporo','Fukuoka'],'BRA':['Manaus'],'IDN':['Medan','Makassar','Jayapura'],'SWE':['Kiruna'],'GRL':['Nuuk'],'ESP':['Barcelona','Seville']}
for a3,names in manual.items():
    for n in names:
        q=P[(P.NAME==n)&(P.a3==a3)]
        if len(q): add(q.sort_values('POP_MAX',ascending=False).iloc[0])
        else: print('manual miss',a3,n)
for bad in [('New Delhi','IND')]: sel.pop(bad,None)
if ('Delhi','IND') in sel: sel[('Delhi','IND')]['cap']=1
L=list(sel.values())
for v in L: 
    if v['zh']: v['zh']=cc.convert(v['zh'])
def tier(p): return 1 if p>=1e7 else 2 if p>=3e6 else 3 if p>=1e6 else 4
for v in L: v['tier']=tier(v['pop'])
print(len(L),collections.Counter(v['tier'] for v in L),len({v['a3'] for v in L}))
print('countries with none:',[ (r.a3,r.zh,round(r['pop']/1e6,2)) for _,r in C.iterrows() if r.a3 not in {v['a3'] for v in L} and r['pop']>5e4])
for a3 in ['CHN','USA','IND','RUS','BRA','JPN','DEU','GBR','FRA','ESP','ITA','NGA','EGY','ZAF','AUS','CAN','KOR','MEX','ARG','IDN']:
    print(a3,[ (v['zh'],round(v['pop']/1e6,1),v['tier']) for v in sorted(L,key=lambda x:-x['pop']) if v['a3']==a3])
print('no zh',[v['en'] for v in L if not v['zh']])
json.dump(L,open(f'{OUT}/cities_sel.json','w'),ensure_ascii=False,indent=0)
