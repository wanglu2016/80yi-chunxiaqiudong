#!/usr/bin/env python3
"""Subset Noto CJK SC to the characters this site uses. Needs fonttools + brotli and the Noto CJK .ttc files."""
import os,re,subprocess,sys,glob
T=os.path.dirname(os.path.abspath(__file__));R=os.path.dirname(T);OUT=f'{R}/assets/fonts'
src=sys.argv[1] if len(sys.argv)>1 else '/usr/share/fonts/opentype/noto'
chars=set(chr(c) for c in range(32,127))|set('°×≈→←↑↓–—−·…、。，：；！？（）《》“”‘’％')
for p in [f'{R}/index.html',f'{R}/video.html',f'{R}/assets/app.js',f'{R}/assets/model.js',f'{R}/assets/data.js']:
    s=open(p,encoding='utf8').read()
    chars|={c for c in s if ord(c)>127}
chars|={chr(0xfeff)}-{chr(0xfeff)}
txt=f'{T}/.chars.txt';open(txt,'w',encoding='utf8').write(''.join(sorted(chars)))
print('chars',len(chars))
for name,ttc,idx in [('noto-sans-sc-400','NotoSansCJK-Regular.ttc',2),('noto-sans-sc-500','NotoSansCJK-Medium.ttc',2),('noto-serif-sc-900','NotoSerifCJK-Black.ttc',2)]:
    subprocess.run(['pyftsubset',f'{src}/{ttc}',f'--font-number={idx}',f'--text-file={txt}','--flavor=woff2','--layout-features=*','--no-hinting','--desubroutinize',f'--output-file={OUT}/{name}.woff2'],check=True)
    print(name,os.path.getsize(f'{OUT}/{name}.woff2')>>10,'KB')
os.remove(txt)
