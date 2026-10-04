@if ($errors->any())
  <div class="error">
    <ul>
      @foreach ($errors->all() as $error)
        <li>{{ $error }}</li>
      @endforeach
    </ul>
  </div>
@endif

<label>タイトル</label>
<input type="text" name="title" value="{{ old('title', $memo->title ?? '') }}">
@error('title') <p class="error">{{ $message }}</p> @enderror

<label>本文</label>
<textarea name="body" rows="6">{{ old('body', $memo->body ?? '') }}</textarea>
@error('body') <p class="error">{{ $message }}</p> @enderror

<label>カテゴリ</label>
<select name="category">
  @foreach (['private' => 'プライベート', 'work' => '仕事', 'study' => '学習'] as $value => $label)
    <option value="{{ $value }}" @selected(old('category', $memo->category ?? '') === $value)>
      {{ $label }}
    </option>
  @endforeach
</select>

{{-- タグ（多対多） --}}
@php
  $checkedTagIds = old('tags', isset($memo) ? $memo->tags->pluck('id')->all() : []);
@endphp

<label>タグ</label>
@foreach ($tags as $tag)
  <label style="display:inline-block; margin-right:16px; font-weight:normal">
    <input type="checkbox" name="tags[]" value="{{ $tag->id }}" style="width:auto"
           @checked(in_array($tag->id, $checkedTagIds))>
    {{ $tag->name }}
  </label>
@endforeach

<p style="margin-top:16px">
  <button class="btn" type="submit">{{ $submitLabel }}</button>
  <a href="{{ route('memos.index') }}">キャンセル</a>
</p>