<?php
// Place this file OUTSIDE public_html at ../altus-private/config.php.
return [
    'dsn' => 'mysql:host=localhost;dbname=YOUR_DATABASE;charset=utf8mb4',
    'user' => 'YOUR_DATABASE_USER',
    'password' => 'YOUR_DATABASE_PASSWORD',
    'secret' => '', // Generate with: php -r "echo bin2hex(random_bytes(32));"
    'admin_user' => 'reception',
    'admin_hash' => '', // Generate with backend/bin/password.php.
    'require_https' => true,
];
