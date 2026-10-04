<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Memo;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    /** コメントを保存 */
    public function store(Request $request, Memo $memo)
    {
        $validated = $request->validate([
            'body' => 'required|max:200',
        ]);

        // 「このメモの」コメントとして作る。memo_id は自動で入る
        $memo->comments()->create($validated);

        return redirect()
            ->route('memos.show', $memo)
            ->with('success', 'コメントを追加しました');
    }

    /** コメントを削除 */
    public function destroy(Comment $comment)
    {
        $memo = $comment->memo;   // 戻り先のために、先に親のメモを取っておく
        $comment->delete();

        return redirect()
            ->route('memos.show', $memo)
            ->with('success', 'コメントを削除しました');
    }
}