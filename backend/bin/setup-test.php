<?php
// LOCAL TEST HELPER ONLY. Run with ALTUS_TEST_CONFIG pointing to a private temp file.
declare(strict_types=1);
$path = getenv('ALTUS_TEST_CONFIG');
if (!$path || PHP_SAPI !== 'cli') exit(1);
$config = ['dsn'=>'mysql:host=127.0.0.1;port=33317;dbname=altus_test;charset=utf8mb4','user'=>'root','password'=>'','secret'=>bin2hex(random_bytes(32)),'admin_user'=>'testdesk','admin_hash'=>password_hash('Altus-local-test-only!', PASSWORD_DEFAULT),'require_https'=>false];
file_put_contents($path, '<?php return '.var_export($config,true).';');
$db=new PDO('mysql:host=127.0.0.1;port=33317','root','');
$db->exec('CREATE DATABASE IF NOT EXISTS altus_test CHARACTER SET utf8mb4');
$db->exec('USE altus_test');
$db->exec(file_get_contents(__DIR__.'/../schema.sql'));
echo "Isolated test database ready.\n";
