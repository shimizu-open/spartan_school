<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tag extends Model
{
    protected $fillable = ['name'];

    /** このタグが付いているメモ（多対多） */
    public function memos()
    {
        return $this->belongsToMany(Memo::class);
    }
}