<?php

namespace Database\Seeders;

use App\Models\Article;
use Illuminate\Database\Seeder;

class ArticleSeeder extends Seeder
{
    public function run(): void
    {
        $articles = [
            ['title' => 'ブログを開設しました', 'body' => '今日からブログを始めます。よろしくお願いします。', 'views' => 120],
            ['title' => 'CSSを学んだ',          'body' => 'Flexbox と Grid がようやく分かってきた。',       'views' => 85],
            ['title' => 'JSに入門した',         'body' => 'DOM操作と配列メソッドを練習中。',                'views' => 42],
        ];

        foreach ($articles as $article) {
            Article::create($article);
        }
    }
}