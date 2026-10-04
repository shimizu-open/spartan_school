<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Comment extends Model
{
    protected $fillable = ['body'];

    /** このコメントが付いているメモ（コメントは1つのメモに属する） */
    public function memo()
    {
        return $this->belongsTo(Memo::class);
    }
}