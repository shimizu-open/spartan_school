
FROM php:8.4-fpm-bookworm

COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

RUN apt-get update && \
    apt-get -y install --no-install-recommends git unzip curl libzip-dev libicu-dev libonig-dev && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    docker-php-ext-install intl pdo_mysql zip bcmath

RUN groupadd -g 1000 appuser && useradd -u 1000 -g appuser -m appuser
USER appuser
WORKDIR /data
