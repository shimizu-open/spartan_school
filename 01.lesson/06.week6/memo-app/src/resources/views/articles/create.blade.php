@extends('layouts.app')

@section('title', '記事を書く')

@section('content')
    <h1>記事を書く</h1>

    @if ($errors->any())
        <x-alert type="danger">
            <ul>
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </x-alert>
    @endif

    <form method="POST" action="{{ route('articles.store') }}">
        @csrf

        <p>
            <input type="text" name="title" placeholder="タイトル" value="{{ old('title') }}">
            @error('title')
                <span style="color: red;">{{ $message }}</span>
            @enderror
        </p>

        <p>
            <textarea name="body" placeholder="本文">{{ old('body') }}</textarea>
            @error('body')
                <span style="color: red;">{{ $message }}</span>
            @enderror
        </p>

        <button>送信</button>
    </form>
@endsection