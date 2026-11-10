<?php
// Development routing mirrors Hostinger's public .htaccess rules.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('~^/admin/(reception|dr\.chetan|dr\.mounika)/?$~D',$path)) {
 header('Content-Type: text/html; charset=utf-8');readfile(dirname(__DIR__).'/dist/admin/index.html');return true;
}
if (preg_match('~^/([a-z0-9-]+)$~D', $path, $match)) {
    $file = dirname(__DIR__).'/dist/'.$match[1].'.html';
    if (is_file($file)) {header('Content-Type: text/html; charset=utf-8');readfile($file);return true;}
}
return false;
