#!/usr/bin/env python3
"""Build index.html and assets/ from tools/site + tools/pipeline/data/bundle.json. Run from anywhere."""
import json,os,shutil
T=os.path.dirname(os.path.abspath(__file__));R=os.path.dirname(T);SRC=f'{T}/site'
rd=lambda p:open(p,encoding='utf8').read()
bundle=rd(f'{T}/pipeline/data/bundle.json');b=json.loads(bundle)
valid=f'{T}/pipeline/data/validation.html'
notes=rd(f'{SRC}/notes.html').replace('{{VALID}}',rd(valid)).replace('{{NCITY}}',str(len(b['CITY']))).replace('{{NCOUNTRY}}',str(len({c['c'] for c in b['CITY']})))
html=rd(f'{SRC}/head.html')+rd(f'{SRC}/body.html')+f'<template id="notesT">{notes}</template>\n<script src="assets/data.js"></script>\n<script src="assets/model.js"></script>\n<script src="assets/app.js"></script>\n</body>\n</html>\n'
open(f'{R}/index.html','w',encoding='utf8').write(html)
open(f'{R}/assets/data.js','w',encoding='utf8').write('window.ATLAS_DATA='+bundle+';\n')
for f in ('style.css','model.js','app.js'): shutil.copy(f'{SRC}/{f}',f'{R}/assets/{f}')
print('built',round(os.path.getsize(f'{R}/assets/data.js')/1e6,2),'MB data')
