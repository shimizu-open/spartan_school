<?php

namespace Database\Seeders;

use App\Models\Tag;
use Illuminate\Database\Seeder;

class TagSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['重要', '買い物', 'アイデア', 'あとで読む'] as $name) {
            Tag::firstOrCreate(['name' => $name]);   // 何回実行しても、同じタグは増えない
        }
    }
}