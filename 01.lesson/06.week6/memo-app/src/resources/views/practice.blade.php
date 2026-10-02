<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>Blade練習</title></head>
<body>

  {{-- ① if --}}
  @if ($count > 10)
    <p>たくさんあります</p>
  @elseif ($count > 0)
    <p>{{ $count }} 件です</p>
  @else
    <p>まだありません</p>
  @endif

  {{-- ② unless（〜でなければ） --}}
  @unless ($count > 0)
    <p>1件もありません</p>
  @endunless

  {{-- ③ isset / empty --}}
  @isset($user)
    <p>{{ $user }} さん</p>
  @endisset

  @empty($items)
    <p>空っぽです</p>
  @endempty

  {{-- ④ foreach --}}
  <ul>
    @foreach ($items as $item)
      <li>{{ $item }}</li>
    @endforeach
  </ul>

  {{-- ⑤ forelse（空のときの分岐が書ける・便利） --}}
  <ul>
    @forelse ($items as $item)
      <li>{{ $item }}</li>
    @empty
      <li>データがありません</li>
    @endforelse
  </ul>

  {{-- ⑥ $loop 変数（ループの情報が自動で入る） --}}
  @foreach ($items as $item)
    <p>
      {{ $loop->iteration }}番目 / 全{{ $loop->count }}件
      @if ($loop->first) ← 最初 @endif
      @if ($loop->last)  ← 最後 @endif
    </p>
  @endforeach

  {{-- ⑦ for / while --}}
  @for ($i = 1; $i <= 3; $i++)
    <span>{{ $i }}</span>
  @endfor

  {{-- ⑧ 条件付きclass（Tailwindで多用する） --}}
  <div @class(['card', 'card--new' => $count > 0])>カード</div>

</body>
</html>