<?php
// CLI only. The password is read from standard input, never from command arguments.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
fwrite(STDERR, "Enter the administrator password (at least 14 characters): ");
$password = trim(fgets(STDIN));
if (strlen($password) < 14) { fwrite(STDERR, "Choose at least 14 characters.
"); exit(1); }
echo password_hash($password, PASSWORD_DEFAULT), PHP_EOL;
