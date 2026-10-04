<?php

namespace App\Http\Controllers;

use App\Models\Memo;
use Illuminate\Http\Request;

class ReminderController extends Controller
{
    /** リマインダーを設定（無ければ作る・あれば上書き） */
    public function update(Request $request, Memo $memo)
    {
        $validated = $request->validate([
            'remind_at' => 'required|date',
        ]);

        $memo->reminder()->updateOrCreate([], $validated);

        return redirect()
            ->route('memos.show', $memo)
            ->with('success', 'リマインダーを設定しました');
    }

    /** リマインダーを解除 */
    public function destroy(Memo $memo)
    {
        $memo->reminder()->delete();

        return redirect()
            ->route('memos.show', $memo)
            ->with('success', 'リマインダーを解除しました');
    }
}