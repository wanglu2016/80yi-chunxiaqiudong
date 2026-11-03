import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from paths import RAW,OUT
import json, math, re, base64, io, collections
import numpy as np, pandas as pd
from datetime import datetime, timedelta, timezone
from PIL import Image, ImageDraw
from shapely.geometry import shape, LineString
import holidays
st=json.load(open(f'{OUT}/stage4.json')); L=st['L']; tzt=st['tzs']; zones=st['zones']
C=pd.read_json(f'{OUT}/countries_stage.json')
clim=json.load(open(f'{OUT}/climate.json'))
d=np.load(f'{OUT}/dots.npz'); la,lo,zo=d['la'],d['lo'],d['zo']
ai={a:i for i,a in enumerate(C.a3)}

# ---- rhythm profiles. Hours are local clock on a normal weekday.
# w wake b bedtime ws/we work start/end l lunch ll lunch length d dinner dl dinner length ss/se school hours
# sat/sun share of employed who work that day, nap midday rest share, c commute scale, eve evening-study share
P={
 'NA' :dict(w=6.15,b=22.25,ws=7.9,we=16.9,l=12.0,ll=.55,d=18.0,dl=.6,ss=8.1,se=15.0,sat=.34,sun=.26,nap=.02,c=.80,eve=.25),
 'UKI':dict(w=6.85,b=22.9,ws=8.4,we=17.0,l=12.75,ll=.5,d=18.6,dl=.6,ss=8.75,se=15.3,sat=.26,sun=.18,nap=.02,c=.95,eve=.25),
 'CEU':dict(w=6.4,b=22.7,ws=7.9,we=16.6,l=12.2,ll=.6,d=18.5,dl=.65,ss=8.0,se=13.75,sat=.24,sun=.14,nap=.04,c=.85,eve=.25),
 'NOR':dict(w=6.5,b=23.0,ws=7.85,we=16.0,l=11.75,ll=.45,d=17.8,dl=.6,ss=8.25,se=14.5,sat=.2,sun=.14,nap=.02,c=.75,eve=.2),
 'FRB':dict(w=6.7,b=22.9,ws=8.2,we=17.6,l=12.5,ll=1.0,d=19.8,dl=.8,ss=8.5,se=16.5,sat=.24,sun=.15,nap=.03,c=.9,eve=.25),
 'ESP':dict(w=7.0,b=23.8,ws=8.1,we=18.3,l=14.25,ll=1.0,d=21.25,dl=.85,ss=9.0,se=16.0,sat=.26,sun=.16,nap=.1,c=.85,eve=.25),
 'ITG':dict(w=6.75,b=23.0,ws=8.0,we=17.7,l=13.0,ll=.85,d=20.2,dl=.8,ss=8.25,se=13.5,sat=.32,sun=.16,nap=.1,c=.8,eve=.3),
 'EEU':dict(w=6.4,b=22.5,ws=7.5,we=16.2,l=12.5,ll=.5,d=18.6,dl=.6,ss=8.0,se=14.0,sat=.26,sun=.16,nap=.04,c=.9,eve=.3),
 'RUS':dict(w=7.0,b=23.25,ws=9.0,we=18.0,l=13.0,ll=.65,d=19.5,dl=.65,ss=8.5,se=14.5,sat=.26,sun=.18,nap=.03,c=1.05,eve=.3),
 'CHN':dict(w=6.8,b=23.0,ws=8.6,we=17.8,l=12.0,ll=1.0,d=18.6,dl=.7,ss=7.9,se=17.0,sat=.33,sun=.25,nap=.28,c=1.0,eve=.65,xs=1.25),
 'JKR':dict(w=6.6,b=23.4,ws=8.75,we=18.2,l=12.1,ll=.6,d=19.3,dl=.55,ss=8.4,se=15.75,sat=.26,sun=.16,nap=.04,c=1.1,eve=.55,xs=.45),
 'SAS':dict(w=6.0,b=22.75,ws=9.4,we=18.4,l=13.25,ll=.6,d=20.6,dl=.65,ss=8.0,se=14.0,sat=.62,sun=.22,nap=.15,c=1.05,eve=.45,xs=1.2),
 'SEA':dict(w=5.75,b=22.3,ws=8.0,we=17.0,l=12.0,ll=.8,d=19.0,dl=.65,ss=7.25,se=14.5,sat=.5,sun=.25,nap=.12,c=1.1,eve=.4),
 'MEN':dict(w=6.4,b=23.3,ws=8.0,we=16.4,l=14.4,ll=.8,d=20.5,dl=.7,ss=7.75,se=13.5,sat=.4,sun=.3,nap=.2,c=1.0,eve=.35),
 'AFR':dict(w=5.75,b=22.0,ws=8.0,we=17.0,l=13.0,ll=.7,d=19.5,dl=.65,ss=7.75,se=14.5,sat=.55,sun=.25,nap=.1,c=1.2,eve=.3),
 'LAT':dict(w=6.0,b=23.0,ws=8.3,we=17.8,l=13.25,ll=.9,d=20.0,dl=.65,ss=7.5,se=13.0,sat=.42,sun=.2,nap=.06,c=1.1,eve=.3),
 'MEX':dict(w=6.4,b=23.25,ws=8.75,we=18.25,l=14.5,ll=.9,d=20.75,dl=.6,ss=8.0,se=13.5,sat=.45,sun=.22,nap=.04,c=1.1,eve=.3),
 'OCE':dict(w=6.4,b=22.5,ws=8.0,we=16.75,l=12.5,ll=.5,d=18.25,dl=.6,ss=8.75,se=15.1,sat=.3,sun=.22,nap=.02,c=.85,eve=.2),
}
WDAY={'NA': 0.81, 'UKI': 0.76, 'CEU': 0.73, 'NOR': 0.72, 'FRB': 0.7, 'ESP': 0.72, 'ITG': 0.7, 'EEU': 0.76, 'RUS': 0.8, 'CHN': 0.86, 'JKR': 0.85, 'OCE': 0.77}
for _k,_v in WDAY.items(): P[_k]['wd']=_v
# Martín-Olalla 2018 table: national diary values for employees on weekdays
OV={'USA':dict(w=6.0,b=22.4,ws=7.42,we=16.92),'CAN':dict(w=6.33,b=22.67,ws=7.75,we=16.92),'ESP':dict(w=7.0,b=23.83,ws=8.08,we=18.33),'ITA':dict(w=6.75,b=23.0,ws=8.0,we=17.75),
    'FRA':dict(w=6.67,b=22.92,ws=8.17,we=17.67),'GBR':dict(w=6.83,b=23.0,ws=8.25,we=17.0),'IRL':dict(w=7.25,b=23.75,ws=8.75,we=17.25),'DNK':dict(w=6.58,b=23.25,ws=7.83,we=16.0),
    'DEU':dict(b=22.83),'POL':dict(b=22.17),'SWE':dict(b=23.0),'NOR':dict(b=23.33),'FIN':dict(b=22.83),'BEL':dict(b=23.0),'BGR':dict(b=22.5),'SVN':dict(b=22.0),'LTU':dict(b=22.0),'LVA':dict(b=22.5),'EST':dict(b=22.83)}
sr={'Northern America':'NA','Australia and New Zealand':'OCE','Melanesia':'SEA','Polynesia':'SEA','Micronesia':'SEA','Central America':'LAT','Caribbean':'LAT','South America':'LAT',
    'South-Eastern Asia':'SEA','Southern Asia':'SAS','Eastern Asia':'JKR','Central Asia':'RUS','Western Asia':'MEN','Northern Africa':'MEN','Western Africa':'AFR','Eastern Africa':'AFR','Middle Africa':'AFR','Southern Africa':'AFR',
    'Northern Europe':'NOR','Western Europe':'CEU','Southern Europe':'ITG','Eastern Europe':'EEU'}
over={'CHN':'CHN','HKG':'CHN','MAC':'CHN','TWN':'CHN','MEX':'MEX','ESP':'ESP','GBR':'UKI','IRL':'UKI','FRA':'FRB','BEL':'FRB','LUX':'FRB','RUS':'RUS','BLR':'RUS','UKR':'RUS','MDA':'RUS','MNG':'RUS','GEO':'RUS','ARM':'RUS','AZE':'RUS','KOS':'EEU','SRB':'EEU','HRV':'EEU','BIH':'EEU','SVN':'EEU','ALB':'ITG','MKD':'EEU','MNE':'EEU','EST':'NOR','LVA':'NOR','LTU':'NOR','IRN':'MEN','AFG':'SAS','SGP':'SEA','PRK':'CHN','ZAF':'AFR','GRL':'NOR','ISL':'NOR'}
def prof(r): return over.get(r.a3) or sr.get(r.subreg) or 'AFR'
# weekend: 0=Sun..6=Sat
wk={}
for a in 'DZA BHR BGD EGY IRQ ISR JOR KWT LBY MDV OMN QAT SAU SDN SYR YEM AFG'.split(): wk[a]=[5,6]
wk['IRN']=[5]; wk['NPL']=[6]; wk['BRN']=[5,0]
sc={'CHN':'cn','HKG':'cn','MAC':'cn','TWN':'cn','JPN':'jp','KOR':'kr','PRK':'kr','USA':'us','CAN':'us','GBR':'uk','IRL':'uk','MEX':'mx','RUS':'ru','BLR':'ru','UKR':'ru','KAZ':'ru','UZB':'ru','KGZ':'ru','TJK':'ru','TKM':'ru','MNG':'ru','ARM':'ru','AZE':'ru','GEO':'ru','MDA':'ru','IND':'in','PAK':'in','BGD':'in','NPL':'in','LKA':'lk','AFG':'in','BTN':'in','IDN':'id','PHL':'ph','THA':'th','VNM':'ru','MYS':'my','SGP':'sg','AUS':'au','NZL':'au','ZAF':'za','BWA':'za','NAM':'za','ZWE':'za','ZMB':'za','MOZ':'za','LSO':'za','SWZ':'za','MDG':'za','MWI':'za','TZA':'ke','KEN':'ke','UGA':'ke','RWA':'ke','BDI':'ke','ETH':'et'}
sg={'Northern Europe':'ne','Western Europe':'de','Southern Europe':'me','Eastern Europe':'de','Northern Africa':'na','Western Asia':'na','Western Africa':'wa','Middle Africa':'wa','Eastern Africa':'ke','Southern Africa':'za','South America':'sa','Caribbean':'us','Central America':'mx','Australia and New Zealand':'au','Melanesia':'au','Polynesia':'au','Micronesia':'us','South-Eastern Asia':'id','Southern Asia':'in','Eastern Asia':'cn','Central Asia':'ru','Northern America':'us'}
SCHOOL={ # school breaks, month-day ranges (approximate, by calendar family)
 'cn':[['01-20','02-25'],['07-05','08-31'],['10-01','10-07']],'jp':[['03-25','04-07'],['07-21','08-31'],['12-25','01-07']],'kr':[['07-20','08-18'],['12-24','02-08']],
 'us':[['06-10','08-24'],['11-25','11-29'],['12-22','01-02'],['03-16','03-20']],'uk':[['07-22','09-01'],['12-19','01-04'],['03-28','04-12']],'mx':[['07-16','08-30'],['12-20','01-06']],
 'ru':[['06-01','08-31'],['12-30','01-10']],'in':[['05-15','06-30'],['12-25','01-01']],'lk':[['04-10','04-25'],['08-05','08-25'],['12-10','12-31']],'id':[['06-22','07-12'],['12-20','01-03']],
 'ph':[['04-10','06-05'],['12-20','01-04']],'th':[['03-15','05-15'],['10-10','10-31']],'my':[['03-20','03-29'],['05-25','06-07'],['08-29','09-06'],['12-05','12-31']],'sg':[['03-14','03-22'],['05-30','06-28'],['09-05','09-13'],['11-21','12-31']],
 'au':[['12-18','01-27'],['04-03','04-19'],['06-27','07-12'],['09-19','10-04']],'za':[['12-10','01-13'],['03-28','04-07'],['06-27','07-20'],['09-24','10-05']],'ke':[['04-04','04-26'],['08-02','08-23'],['10-30','01-04']],'et':[['06-15','09-10']],
 'ne':[['06-20','08-15'],['12-22','01-06'],['04-02','04-12']],'de':[['07-01','08-14'],['12-23','01-05'],['03-30','04-10']],'me':[['06-20','09-10'],['12-23','01-06'],['04-02','04-07']],
 'na':[['06-15','09-05'],['01-25','02-05']],'wa':[['07-01','09-15'],['12-20','01-05'],['04-01','04-14']],'sa':[['12-20','02-25'],['07-06','07-24']]}
RAM={}
for a in 'SAU EGY ARE KWT QAT BHR OMN YEM IRQ JOR PSX SYR LBY TUN DZA MAR SDN MRT SOM DJI COM PAK BGD AFG IRN IDN MYS BRN MDV NER MLI SEN GMB GIN'.split(): RAM[a]=.72
for a in 'TUR LBN ALB BIH KOS AZE KAZ UZB KGZ TJK TKM TCD BFA SLE NGA'.split(): RAM[a]=.35
rows=[]
HOL=json.load(open(f'{OUT}/holidays_raw.json'))
# translated holiday names
T=[(r"New Year|Año Nuevo|Jour de l'an|رأس السنة الميلادية|元日|元旦|Tahun Baru Masehi|Новогодн|Новый год",'新年'),(r"Christmas|Navidad|Noël|Weihnacht|Natal",'圣诞节'),(r'Boxing',"节礼日"),(r"Good Friday|Viernes Santo|Vendredi saint|Karfreitag",'耶稣受难日'),(r"Easter|Pâques|Pascua|Ostern",'复活节'),
   (r"Labou?r Day|Fête du Travail|Día del Trabajo|عيد العمال|Hari Buruh|May Day|Tag der Arbeit",'劳动节'),(r"Independence|Día de la Independencia|عيد الاستقلال|Fête de l'indépendance",'独立日'),(r"Fête nationale|National Day|Dia Nacional|اليوم الوطني",'国庆日'),
   (r"Eid al-Fitr|عيد الفطر|Idul Fitri|Id-ul-Fitr|Ramazan|Ramadan Bayram|Hari Raya Puasa",'开斋节'),(r"Eid al-Adha|عيد الأضحى|Idul Adha|Id-ul-Zuha|Bakrid|Kurban|Hari Raya Haji|يوم عرفة",'宰牲节'),(r"رأس السنة الهجرية|Islamic New Year|Muharram|Tahun Baru Islam",'伊斯兰新年'),(r"المولد النبوي|Prophet|Milad|Maulid|Mawlid",'圣纪节'),
   (r"Diwali|Deepavali",'排灯节'),(r"Holi\b",'洒红节'),(r"Chinese New Year|Lunar New Year|Imlek|Tết|Seollal|Spring Festival",'农历新年'),(r"Thanksgiving",'感恩节'),(r"Republic Day",'共和国日'),(r"Constitution",'宪法日'),(r"All Saints|Toussaint|Todos los Santos",'诸圣节'),(r"Assumption|Assomption|Asunción",'圣母升天节'),(r"Ascension",'耶稣升天节'),(r"Pentecost|Whit",'圣灵降临节'),(r"Corpus Christi",'基督圣体节'),(r"Carnaval|Carnival",'狂欢节'),(r"Nowruz|Nauryz|Novruz|Navruz",'诺鲁孜节'),(r"Vesak|Buddha|Waisak",'卫塞节'),(r"Victory|Victoire",'胜利日'),(r"Martin Luther King",'马丁·路德·金纪念日'),(r"Mid-?Autumn",'中秋节'),(r"Golden|Showa|Greenery|Children's Day|Emperor|Mountain|Marine|Health|Culture|Labor Thanksgiving|Foundation|Vernal|Autumnal|Respect for the Aged|Coming of Age",'日本公共假日'),(r"Queen|King's Birthday",'君主诞辰假日'),(r"Veterans|Memorial",'纪念日'),(r"Summer Bank|Early May Bank|Spring Bank|Bank Holiday",'银行假日')]
def tr(n,a3):
    if a3 in ('CHN','HKG','MAC','TWN') and re.search('[一-鿿]',n):
        n=re.sub(r'（.*?）','',n); return n.strip()
    for rx,z in T:
        if re.search(rx,n,re.I): return z
    return '公共假期'
names=[]; ni={}
def nid(s):
    if s not in ni: ni[s]=len(names); names.append(s)
    return ni[s]
for a3,rs in HOL.items():
    pass
hol={}; mk={}
for a3,rs in HOL.items():
    m={}
    for dd,n in rs:
        m[dd]=nid(tr(n,a3))
        g=re.search(r'由 2026-(\d\d-\d\d) 调休',n)
        if g: mk.setdefault(a3,[]).append(g.group(1))
    hol[a3]=m
print('holiday names',len(names),names[:40]); print('makeup',mk)
_w=pd.read_csv(f'{RAW}/wdi_sl_tlf_acti_zs.csv'); _c=list(_w.columns); _w=_w[_w['time']>=2015].sort_values('time').groupby('geo').tail(1)
C['acti']=C['iso3'].map(dict(zip(_w['geo'].str.upper(),_w[_c[2]])))
C.loc[C.a3=='TWN','acti']=70.0  # DGBAS 15-64 participation, rounded
C['acti']=C['acti'].fillna(C.groupby('subreg')['acti'].transform('median')).fillna(C['acti'].median())
RAWC=pd.read_json(f'{OUT}/countries_raw.json').set_index('a3')
cout=[]
for _,r in C.iterrows():
    p=prof(r); a=r.a3
    cout.append(dict(a=a,z=r.zh,e=r['name'],p=round(float(r['pop'])),s=[round(float(r.a0),4),round(float(r.a1),4),round(float(r.a2),4),round(float(r.a3_),4),round(float(r.a4),4)],m=int(r.med),emp=round(float(r.emp),1),lfp=round(float(r.lfp),1),acti=round(float(r.acti),1),a15=round(float(RAWC.loc[r.a3,'a15']),4),v=round(float(r.vuln),1),ag=round(float(r.agr),1),ter=round(float(r.ter),1),sec=round(float(r.sec),1),prm=round(float(r.prm),1),pre=round(float(r.pre),1),f=p,o=OV.get(a,None),wk=wk.get(a,[6,0]),sc=sc.get(a) or sg.get(r.subreg) or 'wa',r=RAM.get(a,0),h=hol.get(a,{}),mk=mk.get(a,[])))
cities=[]
for c in sorted(L,key=lambda x:-x['pop']):
    cities.append(dict(z=c['zh'],e=c['en'],c=ai[c['a3']],la=round(c['lat'],3),lo=round(c['lon'],3),p=round(c['pop']),s=c['src'],k=c['cap'],t=[x[0] for x in tzt].index(c['tz']),cl=c['clim'],cd=c['cd']))
tier=lambda p:1 if p>=1e7 else 2 if p>=3e6 else 3 if p>=1e6 else 4
print(collections.Counter(tier(c['p']) for c in cities), len(cities))
print(len(C), C['pop'].sum())
# ---- land mask
W,H=8192,4096
img=Image.new('L',(W,H),0); dr=ImageDraw.Draw(img)
for f in json.load(open(f'{RAW}/ne_admin0.geojson'))['features']:
    g=shape(f['geometry']).buffer(0)
    for p in (g.geoms if hasattr(g,'geoms') else [g]):
        ring=[((x+180)/360*W,(90-y)/180*H) for x,y in p.exterior.coords]
        dr.polygon(ring,fill=255)
        for h in p.interiors: dr.polygon([((x+180)/360*W,(90-y)/180*H) for x,y in h.coords],fill=0)
small=img.resize((3072,1536),Image.LANCZOS)
b=io.BytesIO(); small.convert('L').quantize(8).save(b,'PNG',optimize=True); land=b.getvalue(); print('land png',len(land))
# ---- borders from world-atlas arcs
t=json.load(open(f'{RAW}/npm/package/countries-50m.json'))
sc_=t['transform']['scale']; tr_=t['transform']['translate']
arcs=[]
for arc in t['arcs']:
    x=y=0; pts=[]
    for dx,dy in arc:
        x+=dx;y+=dy; pts.append((x*sc_[0]+tr_[0],y*sc_[1]+tr_[1]))
    if len(pts)>=2:
        s=LineString(pts).simplify(0.06,preserve_topology=False)
        cs=list(s.coords)
        if len(cs)>=2: arcs.append(cs)
flat=[]
for a in arcs:
    for x,y in a: flat+= [round(y*100),round(x*100)]
    flat+=[-32768,-32768]
bord=np.array(flat,dtype=np.int16); print('border pts',len(flat)//2,bord.nbytes)
# ---- daylight share per day × quarter hour (UTC)
w_c=C.set_index('a3')['pop'].to_dict()
cnt=collections.Counter(int(z) for z in zo)
zw=np.zeros(len(zones))
cz=collections.Counter()
for i,z in enumerate(zones): cz[z[0]]+=z[2]
pops=C['pop'].values
dw=np.array([pops[zones[int(z)][0]]/cz[zones[int(z)][0]] for z in zo])
lat=la/100.; lon=lo/100.
bk=(np.floor((lat+90)/2).astype(int))*1000+np.floor((lon+180)/2).astype(int)
u,inv=np.unique(bk,return_inverse=True); bw=np.bincount(inv,dw); blat=np.bincount(inv,dw*lat)/bw; blon=np.bincount(inv,dw*lon)/bw
print('bins',len(u),bw.sum())
def sun(ms):
    jd=ms/86400000+2440587.5; n=jd-2451545.0
    L0=(280.46646+.9856474*n)%360; g=math.radians((357.52911+.98560028*n)%360)
    Cc=(1.914602)*math.sin(g)+.019993*math.sin(2*g)+.000289*math.sin(3*g)
    lam=math.radians(L0+Cc); eps=math.radians(23.43929-.00000036*n)
    dec=math.asin(math.sin(eps)*math.sin(lam))
    ra=math.degrees(math.atan2(math.cos(eps)*math.sin(lam),math.cos(lam)))%360
    eot=((L0-ra+180)%360-180)*4
    return dec,eot
t0=int(datetime(2026,1,1,tzinfo=timezone.utc).timestamp()*1000)
out=np.zeros((365,96),np.uint8)
sl,cl=np.sin(np.radians(blat)),np.cos(np.radians(blat))
for dd in range(365):
    for q in range(96):
        ms=t0+(dd*96+q)*900000; de,eot=sun(ms)
        utc=q/4; H=np.radians(15*(utc-12+eot/60)+blon)
        s=sl*math.sin(de)+cl*math.cos(de)*np.cos(H)
        out[dd,q]=round(255*bw[s>math.sin(math.radians(-.833))].sum()/bw.sum())
print('daylight share range',out.min()/255,out.max()/255,'mean',out.mean()/255)
b=io.BytesIO(); Image.fromarray(out).save(b,'PNG',optimize=True); dayl=b.getvalue(); print('daylight png',len(dayl))
def b64(x): return base64.b64encode(x if isinstance(x,bytes) else x.tobytes()).decode()
B=dict(year=2026,world=8335111500,per=100000,P=P,SCHOOL=SCHOOL,HN=names,C=cout,T=[[x[0],x[1],x[2]] for x in tzt],Z=zones,CITY=cities,CL=[dict(n=r['name'],t=r['t'],s=r['src']) for r in clim],
 dla=b64(la),dlo=b64(lo),dzo=b64(zo),bord=b64(bord),land=b64(land),dayl=b64(dayl))
s=json.dumps(B,ensure_ascii=False,separators=(',',':'))
open(f'{OUT}/bundle.json','w').write(s); print('bundle bytes',len(s.encode()))
print({k:len(json.dumps(v,ensure_ascii=False)) for k,v in B.items()})
