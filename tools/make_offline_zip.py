#!/usr/bin/env python3
"""Build download/80yi-chunxiaqiudong-site.zip: everything needed to run by double-clicking index.html."""
import os,zipfile
T=os.path.dirname(os.path.abspath(__file__));R=os.path.dirname(T);name='80yi-chunxiaqiudong'
out=f'{R}/download/{name}-site.zip';tmp=out+'.tmp'
with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    z.write(f'{R}/index.html',f'{name}/index.html');z.write(f'{R}/README.md',f'{name}/README.md');z.write(f'{T}/使用说明.txt',f'{name}/使用说明.txt')
    for d,_,fs in os.walk(f'{R}/assets'):
        for f in sorted(fs):
            p=os.path.join(d,f);z.write(p,f'{name}/'+os.path.relpath(p,R))
os.replace(tmp,out);print(out,round(os.path.getsize(out)/1e6,2),'MB')
