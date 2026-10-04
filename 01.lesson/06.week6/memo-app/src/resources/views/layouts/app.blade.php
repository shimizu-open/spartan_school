<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>@yield('title', 'メモアプリ')</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.7; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 12px; }
    a { color: #2563eb; }
    .card { position: relative; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .card.pinned { border-color: #f59e0b; background: #fffbeb; }
    /* ピン留めボタン：カードの右上。ピン留めしていないときは薄く、しているときははっきり */
    .pin-form { position: absolute; top: 10px; right: 10px; }
    .pin-btn { background: none; border: 0; padding: 4px; font-size: 20px; line-height: 1; cursor: pointer; opacity: .25; }
    .pin-btn:hover { opacity: .6; }
    .card.pinned .pin-btn { opacity: 1; }
    .card > h3 { margin-right: 40px; }
    .flash { background: #dcfce7; color: #166534; padding: 12px; border-radius: 8px; }
    .error { color: #dc2626; font-size: 14px; }
    .btn { display: inline-block; padding: 8px 16px; background: #2563eb; color: #fff; border: 0; border-radius: 6px; cursor: pointer; text-decoration: none; }
    .btn.danger { background: #dc2626; }
    input, textarea, select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
    label { display: block; margin-top: 12px; font-weight: bold; }
    /* ページ送り（$memos->links()）：標準のビューは Tailwind CSS 前提なので、最低限の見た目をここで補う */
    nav[role="navigation"] { margin-top: 16px; }
    nav[role="navigation"] > div:first-child { display: none; }
    nav[role="navigation"] svg { width: 20px; height: 20px; vertical-align: middle; }
    nav[role="navigation"] a, nav[role="navigation"] span[aria-current] > span, nav[role="navigation"] span[aria-disabled] > span { display: inline-block; padding: 4px 10px; }
  </style>
</head>
<body>
  <header>
    <h1><a href="{{ route('memos.index') }}">📝 メモアプリ</a></h1>
    <a class="btn" href="{{ route('memos.create') }}">新規作成</a>
  </header>

  @if (session('success'))
    <p class="flash">{{ session('success') }}</p>
  @endif

  <main>
    @yield('content')
  </main>
</body>
</html>