<?php

namespace Database\Factories;

use App\Models\Article;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Article>
 */
class ArticleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title'     => fake()->realText(20),
            'body'      => fake()->realText(100),
            'views'     => fake()->numberBetween(0, 500),
            'category'  => fake()->randomElement(['work', 'private', null]),
            'is_pinned' => fake()->boolean(20),      // 20%の確率で true
        ];
    }
}
