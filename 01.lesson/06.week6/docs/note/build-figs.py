#!/usr/bin/env python3
"""公開版 HTML の図（SVG）を、note に貼れる PNG にする。
   使い方: python3 note/build-figs.py
   出力:   note/figs/fig-*.png"""
import re, os, json, subprocess, tempfile

OUT  = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(os.path.dirname(OUT), 'feature-design-flow-public.html')
FIGS = os.path.join(OUT, 'figs'); os.makedirs(FIGS, exist_ok=True)
src  = open(SRC, encoding='utf-8').read()
css  = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
defs = re.search(r'<svg width="0".*?</svg>', src, re.S).group(0)
NAMES = {'vmodel': ['vmodel'], 'need': ['need'], 'three': ['one2many', 'one2one', 'many2many'], 'order': ['order'], 'ex2': ['project']}

with tempfile.TemporaryDirectory() as tmp:
    jobs = []
    for sid, names in NAMES.items():
        sec = re.search(r'<section id="%s">.*?</section>' % sid, src, re.S).group(0)
        svgs = re.findall(r'<div class="fig">\s*(<svg.*?</svg>)', sec, re.S)
        assert len(svgs) == len(names), (sid, len(svgs))
        for name, svg in zip(names, svgs):
            page = (f'<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><style>{css}\n'
                    'body{background:#fff;margin:0} #w{width:760px;padding:14px 16px} #w svg{display:block;width:100%;height:auto}</style></head>'
                    f'<body>{defs}<div id="w">{svg}</div></body></html>')
            p = os.path.join(tmp, name + '.html'); open(p, 'w', encoding='utf-8').write(page)
            jobs.append({'url': 'file://' + p, 'out': os.path.join(FIGS, f'fig-{name}.png'), 'selector': '#w', 'width': 792, 'scale': 2})
    jp = os.path.join(tmp, 'jobs.json'); json.dump(jobs, open(jp, 'w'))
    subprocess.run(['node', os.path.join(OUT, 'shot.mjs'), jp], check=True)
