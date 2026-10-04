<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Memo extends Model
{
    protected $fillable = ['title', 'body', 'category', 'is_pinned'];

    /** このメモのコメント（1対多） */
    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    /** このメモのリマインダー（1対1） */
    public function reminder()
    {
        return $this->hasOne(Reminder::class);
    }

    /** このメモのタグ（多対多） */
    public function tags()
    {
        return $this->belongsToMany(Tag::class);
    }
}