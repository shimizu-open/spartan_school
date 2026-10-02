<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'すぱるた塾ブログ')</title>
</head>
<body>
    <header>
        <a href="{{ route('articles.index') }}">すぱるた塾ブログ</a>
    </header>

    <main>
        @yield('content')
    </main>

    <footer>
        <p>&copy; 2026 すぱるた塾</p>
    </footer>
</body>
</html>