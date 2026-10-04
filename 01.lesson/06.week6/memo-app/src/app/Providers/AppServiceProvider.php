<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // CloudFront の後ろ（EC2 には http で届く）でも、本番では https の URL を作る
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}