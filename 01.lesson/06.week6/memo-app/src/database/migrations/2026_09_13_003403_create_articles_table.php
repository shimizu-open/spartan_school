<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->id();                          // 主キー（自動連番）
            $table->string('title', 100);          // VARCHAR(100)
            $table->text('body');                  // 長文
            $table->integer('views')->default(0);  // 整数・既定値0
            $table->timestamps();                  // created_at / updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};