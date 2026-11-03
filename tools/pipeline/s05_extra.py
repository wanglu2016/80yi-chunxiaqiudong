import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from paths import RAW,OUT
import json, collections, holidays
import pandas as pd
C=pd.read_json(f'{OUT}/countries_stage.json')
ne=json.load(open(f'{RAW}/ne_admin0.geojson'))['features']
a2={}
for f in ne:
    p=f['properties']; a2[p['ADM0_A3']]=p.get('ISO_A2_EH') if p.get('ISO_A2_EH') not in (None,'-99') else p.get('ISO_A2')
a2.update({'KOS':'XK','PSX':'PS','SDS':'SS','TWN':'TW','HKG':'HK','MAC':'MO','FRA':'FR','NOR':'NO'})
sup=holidays.list_supported_countries()
def _h(c):
    if c in ('CN','HK','MO','TW'): 
        try: return holidays.country_holidays(c,years=2026,language='zh_CN')
        except Exception: pass
    try: return holidays.country_holidays(c,years=2026,language='en_US')
    except Exception: return holidays.country_holidays(c,years=2026)
names=collections.Counter(); out={}; none=[]
for a3 in C.a3:
    c=a2.get(a3)
    if c in sup:
        try:
            h=_h(c)
        except Exception as e:
            print('err',a3,e); continue
        rows=sorted((d.isoformat()[5:],n) for d,n in h.items())
        out[a3]=rows
        for _,n in rows: names[n]+=1
    else: none.append(a3)
print(len(out),'none',len(none),none[:60])
print(names.most_common(60))
print(out['CHN']); print(out['JPN'][:6]); print(out['SAU']); print(out['IND'][:12]); print(out['IDN'][:10])
json.dump(out,open(f'{OUT}/holidays_raw.json','w'),ensure_ascii=False)
