#!/usr/bin/env python3
"""note と X（記事）の貼り付け用ページを作る。
   使い方: python3 note/build-note.py
   入力:   note/article.html（記事の本文。直すのはここだけ）
   出力:   note/note-article.html, x/x-article.html（ブラウザで開いてコピーする）
           x/ には、本文に入れる画像もコピーする"""
import html, os, re, shutil

NOTE = os.path.dirname(os.path.abspath(__file__))
X    = os.path.join(os.path.dirname(NOTE), 'x')
article = open(os.path.join(NOTE, 'article.html'), encoding='utf-8').read()
# コードの中の > などをそのまま書けるよう、<code> の中身だけエスケープする
article = re.sub(r'<code>(.*?)</code>', lambda m: '<code>' + html.escape(html.unescape(m.group(1)), quote=False) + '</code>', article, flags=re.S)

TITLES = [
    '「教材は写せるのに、自分で機能を足せない」を抜け出す考え方',
    '写せるのに、足せない。そこから抜け出す「考える順番」',
    '機能を足すときの考え方｜「何がしたい」から「動いた」まで【Laravelで学ぶ】',
]
marks = article.count('class="mark"')
chars = len(re.sub(r'<[^>]+>|\s', '', article))
images = re.findall(r'▼ 画像：(\S+) をここに入れる', article)

CSS = '''
body{margin:0;background:#eef3f8;color:#1a1a1a;font-family:-apple-system,"Hiragino Sans","Yu Gothic UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.9}
.guide{max-width:760px;margin:24px auto;background:#12314e;color:#fff;border-radius:14px;padding:20px 24px}
.guide h1{font-size:18px;margin:0 0 8px} .guide ol{margin:6px 0;padding-left:22px} .guide code{background:rgba(255,255,255,.15);padding:1px 6px;border-radius:4px}
.guide button{font-size:14px;padding:6px 14px;border:0;border-radius:8px;background:#fff;color:#12314e;font-weight:700;cursor:pointer}
.guide .ttl{display:flex;gap:12px;align-items:center;justify-content:space-between;background:rgba(255,255,255,.12);border-radius:8px;padding:8px 12px;margin:6px 0}
.guide .big{font-size:16px;padding:10px 20px;margin-top:10px} #msg{margin-left:10px;font-size:14px}
#article{max-width:620px;margin:0 auto 80px;background:#fff;border-radius:14px;padding:36px 40px;font-size:17px}
#article h2{font-size:24px;margin:52px 0 14px;line-height:1.5} #article h3{font-size:19px;margin:32px 0 6px}
#article p{margin:0 0 22px} #article li{margin:4px 0}
#article pre{background:#f5f5f5;padding:14px 16px;border-radius:8px;overflow-x:auto;font-size:13.5px;line-height:1.7}
#article code{font-family:ui-monospace,Consolas,monospace} #article p code,#article li code{background:#f1f1f1;padding:1px 5px;border-radius:4px;font-size:.9em}
#article blockquote{margin:22px 0;padding:4px 18px;border-left:4px solid #bbb;color:#444} #article blockquote p{margin:6px 0}
#article .mark{background:#e3f1ff;border:1px dashed #2a6fae;border-radius:8px;padding:6px 12px;font-size:14px;color:#12314e}
'''
JS = '''
function copyEl(id){
  var el=document.getElementById(id), r=document.createRange(); r.selectNodeContents(el);
  var s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
  var ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
  s.removeAllRanges();
  document.getElementById('msg').textContent = ok ? 'コピーしました' : 'コピーできませんでした。手で選択してコピーしてください';
}
'''

def page(name, steps, body):
    titles = ''.join(f'<div class="ttl"><span id="t{i}">{html.escape(t)}</span><button onclick="copyEl(\'t{i}\')">コピー</button></div>' for i, t in enumerate(TITLES))
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{name} 貼り付け用</title>
<style>{CSS}</style>
</head>
<body>
<div class="guide">
  <h1>{name} への貼り付け手順</h1>
  <ol>{''.join(f'<li>{s}</li>' for s in steps)}</ol>
  {titles}
  <button class="big" onclick="copyEl('article')">本文をコピー</button><span id="msg"></span>
  <p style="margin:10px 0 0;font-size:13px;opacity:.8">本文は約 {chars:,} 字。文章を直すときは <code>note/article.html</code> を編集して <code>python3 note/build-note.py</code>（note 用と X 用の両方が作り直される）。</p>
</div>
<div id="article">
{body}
</div>
<script>{JS}</script>
</body>
</html>
'''

# ---- note ----
open(os.path.join(NOTE, 'note-article.html'), 'w', encoding='utf-8').write(page('note', [
    '下のタイトル案から1つ選んで「コピー」→ note のタイトル欄に貼る。',
    '「本文をコピー」→ note の本文欄に貼る。',
    f'本文中の「▼ 画像：…… をここに入れる ▼」の行（{marks}か所）を消して、同じ名前の画像を入れる。猫先生のまとめ画像はこのフォルダ、図は <code>figs/</code> にある。',
    '見出し画像には <code>note-thumb.png</code> を使う。',
], article))

# ---- X（記事）----
os.makedirs(X, exist_ok=True)
x_article = article
for n, img in enumerate(images, 1):                      # X 用は画像を1つのフォルダに番号順で置く
    src = os.path.join(NOTE, img)
    dst = f'{n:02d}-' + re.sub(r'^(note-\d-|fig-)', '', os.path.basename(img))
    shutil.copyfile(src, os.path.join(X, dst))
    x_article = x_article.replace(f'▼ 画像：{img} をここに入れる', f'▼ 画像：{dst} をここに入れる')
open(os.path.join(X, 'x-article.html'), 'w', encoding='utf-8').write(page('X の記事', [
    'X の「記事」を新規作成し、下のタイトル案から1つ選んで「コピー」→ タイトル欄に貼る。',
    'カバー画像（上部の画像）に <code>x-cover.png</code>（5:2）を設定する。',
    '「本文をコピー」→ 本文欄に貼る。',
    f'本文中の「▼ 画像：…… をここに入れる ▼」の行（{marks}か所）を消して、同じ名前の画像を入れる。画像はこのフォルダに、出てくる順の番号つきで置いてある。',
], x_article))
print('chars:', chars, '/ h2:', article.count('<h2>'), '/ images:', marks)
