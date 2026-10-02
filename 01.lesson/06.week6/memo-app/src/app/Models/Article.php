<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    use HasFactory;

    protected $fillable = ['title', 'body', 'views', 'category', 'is_pinned'];

    public function user()
    {
    return $this->belongsTo(User::class);        // 記事は1人に属する
    }
}