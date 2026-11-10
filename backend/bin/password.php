<?php
// CLI only. The password is read from standard input, never from command arguments.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
fwrite(STDERR, "Enter the administrator password (at least 10 characters): ");
$password = trim(fgets(STDIN));
if (strlen($password) < 10) { fwrite(STDERR, "Choose at least 10 characters.
"); exit(1); }
echo password_hash($password, PASSWORD_DEFAULT), PHP_EOL;
