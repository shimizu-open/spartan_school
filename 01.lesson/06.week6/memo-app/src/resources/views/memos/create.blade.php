@extends('layouts.app')
@section('title', 'メモを書く')

@section('content')
  <h2>新しいメモ</h2>

  <form method="POST" action="{{ route('memos.store') }}">
    @csrf
    @include('memos._form', ['submitLabel' => '保存する'])
  </form>
@endsection