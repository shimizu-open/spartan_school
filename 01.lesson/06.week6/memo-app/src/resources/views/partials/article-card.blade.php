<article @class([
    'card',
    'card--hot' => $article->views > 100,
]) style="border: 1px solid #ccc; padding: 8px; margin: 8px 0;">

    <h3>
        <a href="{{ route('articles.show', $article->id) }}">{{ Str::limit($article->title, 20) }}</a>
        @if ($article->views > 100)
            <span>🔥 人気</span>
        @endif
    </h3>

    <small>{{ $article->views }} 回閲覧</small>

    <form method="POST" action="{{ route('articles.destroy', $article->id) }}">
        @csrf
        @method('DELETE')
        <button>削除</button>
    </form>
</article>