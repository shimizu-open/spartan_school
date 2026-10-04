@extends('layouts.app')
@section('title', 'メモを編集')

@section('content')
  <h2>メモを編集</h2>

  <form method="POST" action="{{ route('memos.update', $memo) }}">
    @csrf
    @method('PUT')
    @include('memos._form', ['submitLabel' => '更新する'])
  </form>
@endsection