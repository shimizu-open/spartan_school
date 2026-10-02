@extends('layouts.app')

@section('title', $article->title)

@section('content')
    <h1>{{ $article->title }}</h1>
    <p>{{ $article->body }}</p>
    <p>{{ $article->views }} 回閲覧</p>
    <p><a href="{{ route('articles.index') }}">← 一覧へ戻る</a></p>
@endsection