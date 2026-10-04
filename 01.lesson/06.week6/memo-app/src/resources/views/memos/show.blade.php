@extends('layouts.app')
@section('title', $memo->title)

@section('content')
  <div class="card {{ $memo->is_pinned ? 'pinned' : '' }}">
    <h2>{{ $memo->title }}</h2>
    <p style="white-space: pre-wrap">{{ $memo->body }}</p>
    <p>
      @forelse ($memo->tags as $tag)
        <span style="background:#eef2ff; color:#3730a3; padding:2px 8px; border-radius:999px; font-size:12px">#{{ $tag->name }}</span>
      @empty
        <small>タグなし</small>
      @endforelse
    </p>
    <small>
      {{ $memo->category }}／作成 {{ $memo->created_at->format('Y-m-d H:i') }}
      ／更新 {{ $memo->updated_at->diffForHumans() }}
    </small>
  </div>

  <div>
    <a class="btn" href="{{ route('memos.edit', $memo) }}">編集</a>

    <form method="POST" action="{{ route('memos.destroy', $memo) }}"
          style="display:inline" onsubmit="return confirm('本当に削除しますか？')">
      @csrf
      @method('DELETE')
      <button class="btn danger" type="submit">削除</button>
    </form>

    <a href="{{ route('memos.index') }}">一覧に戻る</a>
  </div>

  {{-- リマインダー（1対1） --}}
  <h3>リマインダー</h3>

  @if ($memo->reminder)
    <p>
      ⏰ {{ $memo->reminder->remind_at->format('Y-m-d H:i') }}
      <form method="POST" action="{{ route('memos.reminder.destroy', $memo) }}" style="display:inline">
        @csrf
        @method('DELETE')
        <button type="submit">解除する</button>
      </form>
    </p>
  @else
    <p>まだ設定されていません。</p>
  @endif

  <form method="POST" action="{{ route('memos.reminder.update', $memo) }}">
    @csrf
    @method('PUT')
    <input type="datetime-local" name="remind_at"
           value="{{ old('remind_at', $memo->reminder?->remind_at->format('Y-m-d\TH:i')) }}">
    @error('remind_at') <p class="error">{{ $message }}</p> @enderror
    <p><button class="btn" type="submit">{{ $memo->reminder ? '変更する' : '設定する' }}</button></p>
  </form>

  {{-- コメント（1対多） --}}
  <h3>コメント（{{ $memo->comments->count() }} 件）</h3>

  @forelse ($memo->comments as $comment)
    <div class="card">
      <p style="white-space: pre-wrap">{{ $comment->body }}</p>
      <small>{{ $comment->created_at->format('Y-m-d H:i') }}</small>
      <form method="POST" action="{{ route('comments.destroy', $comment) }}" style="display:inline">
        @csrf
        @method('DELETE')
        <button type="submit">削除</button>
      </form>
    </div>
  @empty
    <p>まだコメントはありません。</p>
  @endforelse

  <form method="POST" action="{{ route('memos.comments.store', $memo) }}">
    @csrf
    <label>コメントを書く</label>
    <textarea name="body" rows="3">{{ old('body') }}</textarea>
    @error('body') <p class="error">{{ $message }}</p> @enderror
    <p><button class="btn" type="submit">コメントする</button></p>
  </form>
@endsection