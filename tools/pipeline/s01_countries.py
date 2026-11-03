import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from paths import RAW,OUT
import pyreadr, pandas as pd, json, numpy as np
r=pyreadr.read_r(f'{RAW}/wpp_popprojAge1dt.rda'); d=r[list(r)[0]]
y=d[d.year=='2026'].copy(); y['pop']=(y.popM+y.popF)*1000
world=y[y.country_code==900]['pop'].sum(); print('world 2026',world)
a=[f['properties'] for f in json.load(open(f'{RAW}/ne_admin0.geojson'))['features']]
rows={}
def n3(p):
    v=p.get('ISO_N3_EH') or p.get('ISO_N3'); 
    try: return int(v)
    except: return None
for p in a:
    c=n3(p)
    if c is None or c<0: continue
    if c in rows and (p.get('POP_EST') or 0)<rows[c]['_p']: continue
    rows[c]={'_p':p.get('POP_EST') or 0,'n3':c,'iso3':p.get('ISO_A3_EH') if p.get('ISO_A3_EH') not in (None,'-99') else p['ADM0_A3'],'a3':p['ADM0_A3'],'name':p['NAME_LONG'] if p.get('NAME_LONG') else p['NAME'],'zh':p.get('NAME_ZH'),'cont':p.get('CONTINENT'),'subreg':p.get('SUBREGION')}
print(len(rows))
rows[412]={'_p':0,'n3':412,'iso3':'XKX','a3':'KOS','name':'Kosovo','zh':'科索沃','cont':'Europe','subreg':'Southern Europe'}
ages=y.groupby('country_code')
out=[]; miss=[]
codes=[c for c in y.country_code.unique() if c<900]
for c in codes:
    g=y[y.country_code==c]; tot=g['pop'].sum()
    if c not in rows: miss.append((int(c),round(tot/1e6,2))); continue
    def s(a,b): return float(g[(g.age>=a)&(g.age<=b)]['pop'].sum()/tot)
    order=g.sort_values('age'); cum=order['pop'].cumsum()/tot; med=float(order.age.iloc[int((cum>=.5).values.argmax())])
    r0=dict(rows[c]); r0.pop('_p',None); r0.update(pop=float(tot),a0=s(0,5),a1=s(6,17),a2=s(18,24),a3_=s(25,64),a4=s(65,200),a15=s(15,200),med=med); out.append(r0)
print('in WPP not NE',miss)
df=pd.DataFrame(out)
fr=sum(float(y[y.country_code==c]['pop'].sum()) for c in (175,638,312,474,254))
df.loc[df.n3==250,'pop']+=fr; print('folded into FRA',fr)
print(len(df),df['pop'].sum()/1e9)
def latest(ind,lo=2015):
    w=pd.read_csv(f'{RAW}/wdi_{ind}.csv'); cols=list(w.columns); w=w[w['time']>=lo].sort_values('time').groupby('geo').tail(1)
    return dict(zip(w['geo'].str.upper(),w[cols[2]]))
inds={'emp':'sl_emp_totl_sp_zs','lfp':'sl_tlf_cact_zs','vuln':'sl_emp_vuln_zs','agr':'sl_agr_empl_zs','ser':'sl_srv_empl_zs','ter':'se_ter_enrr','sec':'se_sec_enrr','prm':'se_prm_enrr','pre':'se_pre_enrr','urb':'sp_urb_totl_in_zs'}
for k,v in inds.items():
    m=latest(v, 2005 if k=='sec' else 2015); df[k]=df['iso3'].map(m); print(k,'missing',df[k].isna().sum(), 'popshare missing', round(df.loc[df[k].isna(),'pop'].sum()/df['pop'].sum(),3))
tw=df[df.iso3=='TWN']; print(tw.T.head(30))
print(df[df.iso3.isin(['CHN','USA','JPN','IND','NGA','DEU'])][['iso3','zh','pop','a0','a1','a2','a3_','a4','med','emp','vuln','agr','ter','sec','prm','pre']])
df.to_json(f'{OUT}/countries_raw.json',orient='records',force_ascii=False)
