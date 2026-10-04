@extends('layouts.app')
@section('title', 'メモ一覧')

@section('content')
  <h2>メモ一覧（全 {{ $memos->total() }} 件）</h2>

  @forelse ($memos as $memo)
    <div class="card {{ $memo->is_pinned ? 'pinned' : '' }}">
      <form class="pin-form" method="POST" action="{{ route('memos.pin', $memo) }}">
        @csrf
        @method('PATCH')
        <button class="pin-btn" type="submit" title="{{ $memo->is_pinned ? 'ピン留めを外す' : 'ピン留めする' }}">📌</button>
      </form>
      <h3>
        <a href="{{ route('memos.show', $memo) }}">{{ $memo->title }}</a>
      </h3>
      <p>{{ Str::limit($memo->body, 60) }}</p>
      <p>
        @foreach ($memo->tags as $tag)
          <span style="background:#eef2ff; color:#3730a3; padding:2px 8px; border-radius:999px; font-size:12px">#{{ $tag->name }}</span>
        @endforeach
      </p>
      <small>
        {{ $memo->category }}／{{ $memo->created_at->format('Y-m-d H:i') }}／💬 {{ $memo->comments_count }} 件
      </small>
    </div>
  @empty
    <p>まだメモがありません。<a href="{{ route('memos.create') }}">最初のメモを書く</a></p>
  @endforelse

  {{ $memos->links() }}
@endsection