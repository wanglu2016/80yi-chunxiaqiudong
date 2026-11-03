import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from paths import RAW,OUT
import json, math, collections, pandas as pd
import geonamescache
L=json.load(open(f'{OUT}/cities_sel.json'))
ne=[f['properties'] for f in json.load(open(f'{RAW}/ne_places.geojson'))['features']]
def hav(a,b,c,d):
    p=math.pi/180; h=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*6371*math.asin(math.sqrt(h))
from opencc import OpenCC
cc=OpenCC('t2s')
# additions
have={(c['en'],c['a3']) for c in L}
add=[('Hamburg','DEU'),('Munich','DEU'),('Frankfurt','DEU'),('Birmingham','GBR'),('Edinburgh','GBR'),('Naples','ITA'),('Turin','ITA'),('Portland','USA'),('New Orleans','USA'),('Kyoto','JPN'),('Hiroshima','JPN'),('Nice','FRA'),('Kathmandu','NPL'),('Yaounde','CMR'),('Yaoundé','CMR')]
for n,a in add:
    if (n,a) in have: continue
    q=[p for p in ne if p['NAME']==n and p['ADM0_A3']==a]
    if q:
        p=max(q,key=lambda x:x['POP_MAX']); L.append(dict(en=n,zh=cc.convert(p['NAME_ZH'] or n),a3=a,lat=p['LATITUDE'],lon=p['LONGITUDE'],pop=float(p['POP_MAX']),src='ne',cap=int(p['ADM0CAP'] or 0),tz=p['TIMEZONE']))
# fix Yaounde (WUP)
for c in L:
    if c['en'] in('Yaounde','Yaoundé') and c['a3']=='CMR': c['pop']=5106000.0; c['src']='wup'
# drops: statistical artefacts and suburbs of a megacity already on the map
drop={'Hechi','Zhangzhou','Haora','Yokohama','Ghaziabad','Incheon','Al Jizah','Giza','Kawasaki','Fort Lauderdale','Baton Rouge','Columbia','Des Moines','Sohag','Sawhaj','Amaravati','Sri Jayawardenepura Kotte'}
L=[c for c in L if c['en'] not in drop]
Z={'Washington, D.C.':'华盛顿','Oklahoma City':'俄克拉何马城','Ahmedabad':'阿默达巴德','Kochi':'科钦','Varanasi':'瓦拉纳西','Kozhikode':'科泽科德','Shillong':'西隆','Vladivostok':'符拉迪沃斯托克','Port Elizabeth':'伊丽莎白港','Jayapura':'查亚普拉','Murcia':'穆尔西亚','San Miguel de Tucuman':'图库曼','Hajipur':'哈吉普尔','Cleveland':'克利夫兰','Delhi':'德里','Shenyeng':'沈阳','Ōsaka':'大阪','Dar es Salaam':'达累斯萨拉姆','Xian':'西安'}
for c in L:
    if c['en'] in Z: c['zh']=Z[c['en']]
print(len(L)); 
# country list for review
C=pd.read_json(f'{OUT}/countries_raw.json').set_index('a3')
print(' '.join(f"{c['zh']}" for c in sorted(L,key=lambda c:(c['a3'],-c['pop']))))
json.dump(L,open(f'{OUT}/cities_final0.json','w'),ensure_ascii=False)
print(' '.join(sorted(set(C.loc[c['a3']].zh for c in L))))
