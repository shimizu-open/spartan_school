<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Reminder extends Model
{
    protected $fillable = ['remind_at'];

    /** remind_at を日時として扱う（->format() が使えるようになる） */
    protected function casts(): array
    {
        return [
            'remind_at' => 'datetime',
        ];
    }

    /** このリマインダーが付いているメモ */
    public function memo()
    {
        return $this->belongsTo(Memo::class);
    }
}