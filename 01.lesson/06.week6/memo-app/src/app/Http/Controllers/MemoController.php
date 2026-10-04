<?php

namespace App\Http\Controllers;

use App\Models\Memo;
use App\Models\Tag;
use Illuminate\Http\Request;

class MemoController extends Controller
{
    /** 一覧 */
    public function index()
    {
        $memos = Memo::with('tags')             // タグをまとめて先に読む（N+1対策。A-4で確かめます）
            ->withCount('comments')             // コメント数を comments_count として付ける
            ->orderByDesc('is_pinned')
            ->latest()
            ->paginate(10);

        return view('memos.index', compact('memos'));
    }

    /** 作成フォーム */
    public function create()
    {
        $tags = Tag::orderBy('id')->get();

        return view('memos.create', compact('tags'));
    }

    /** 保存 */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'    => 'required|max:100',
            'body'     => 'required',
            'category' => 'required|in:private,work,study',
            'tags'     => 'array',
            'tags.*'   => 'exists:tags,id',
        ]);

        $memo = Memo::create($validated);                   // tags は $fillable に無いので、ここでは無視される
        $memo->tags()->sync($request->input('tags', []));   // チェックされたタグで、中間テーブルをそろえる

        return redirect()
            ->route('memos.show', $memo)
            ->with('success', '「'.$memo->title.'」を保存しました');
    }

    /** 詳細 */
    public function show(Memo $memo)
    {
        return view('memos.show', compact('memo'));
    }

    /** 編集フォーム */
    public function edit(Memo $memo)
    {
        $tags = Tag::orderBy('id')->get();

        return view('memos.edit', compact('memo', 'tags'));
    }

    /** 更新 */
    public function update(Request $request, Memo $memo)
    {
        $validated = $request->validate([
            'title'    => 'required|max:100',
            'body'     => 'required',
            'category' => 'required|in:private,work,study',
            'tags'     => 'array',
            'tags.*'   => 'exists:tags,id',
        ]);

        $memo->update($validated);
        $memo->tags()->sync($request->input('tags', []));

        return redirect()
            ->route('memos.show', $memo)
            ->with('success', '更新しました');
    }

    /** ピン留めを切り替える */
    public function togglePin(Memo $memo)
    {
        $memo->update(['is_pinned' => ! $memo->is_pinned]);   // 今の値を反転する（true ⇄ false）

        return redirect()
            ->route('memos.index')
            ->with('success', $memo->is_pinned ? 'ピン留めしました' : 'ピン留めを外しました');
    }

    /** 削除 */
    public function destroy(Memo $memo)
    {
        $memo->delete();

        return redirect()
            ->route('memos.index')
            ->with('success', '削除しました');
    }
}