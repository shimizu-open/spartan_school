@extends('layouts.app')

@section('title', '記事一覧')

@section('content')
    <h1>記事一覧</h1>

    @if (session('success'))
        <x-alert type="success">{{ session('success') }}</x-alert>
    @endif

    <form method="GET" action="{{ route('articles.index') }}">
        <input type="text" name="q" value="{{ request('q') }}" placeholder="タイトル検索">
        <button>検索</button>
    </form>

    <h2>🔥 人気の記事</h2>
    @foreach ($popular as $article)
        @include('partials.article-card', ['article' => $article])
    @endforeach

    <h2>すべての記事（全{{ $articles->count() }}件）</h2>
    @forelse ($articles as $article)
        <p>{{ $loop->iteration }}件目 / 全{{ $loop->count }}件</p>
        @include('partials.article-card', ['article' => $article])
        @unless ($loop->last)
            <hr>
        @endunless
    @empty
        <p>記事が見つかりません</p>
    @endforelse
@endsection