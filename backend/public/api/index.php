<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Kolkata');
ini_set('display_errors', '0');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

function fail(int $status, string $message): never {
    global $db;
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message]);
    exit;
}

$configPath = getenv('ALTUS_CONFIG') ?: dirname(__DIR__, 2) . '/altus-private/config.php';
if (!is_file($configPath)) {
    fail(503, 'Online booking is being connected. Please call the clinic to arrange your visit.');
}
$config = require $configPath;
if (($config['secret'] ?? '') === '' || strlen($config['secret']) < 32) {
    fail(503, 'Booking configuration is incomplete. Please call the clinic.');
}
if (!empty($config['require_https']) && (($_SERVER['HTTPS'] ?? '') !== 'on')) {
    fail(400, 'Please use the secure HTTPS website.');
}
ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', '28800');
session_name('altus_' . substr(hash('sha256',$config['dsn']),0,12));
session_set_cookie_params([
    'httponly' => true, 'secure' => !empty($config['require_https']),
    'samesite' => 'Strict', 'path' => '/',
]);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(24));

try {
    $db = new PDO($config['dsn'], $config['user'] ?? '', $config['password'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $db->exec("SET time_zone = '+05:30'");
} catch (Throwable $error) {
    error_log('Altus database connection failed.');
    fail(503, 'Booking is temporarily unavailable. Please call the clinic.');
}

function query(string $sql, array $params = []): PDOStatement {
    global $db;
    $statement = $db->prepare($sql);
    $statement->execute($params);
    return $statement;
}

function respond(array $body, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function input(): array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        fail(405, 'Use POST for this action.');
    }
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
        fail(415, 'Send JSON.');
    }
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 12000) {
        fail(413, 'The message is too large.');
    }
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        fail(403, 'Your session expired. Refresh the page and try again.');
    }
    $raw = file_get_contents('php://input', false, null, 0, 12001);
    if (strlen($raw) > 12000) fail(413, 'The message is too large.');
    try { $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR); }
    catch (Throwable $error) { fail(400, 'Invalid request.'); }
    if (!is_array($data) || !str_starts_with(ltrim($raw), '{')) fail(400, 'Invalid request.');
    return $data;
}

function textValue(array $data, string $field, int $limit, bool $required = true): string {
    $value = $data[$field] ?? '';
    if (!is_string($value)) fail(422, 'Please check ' . $field . '.');
    $value = trim($value);
    if (!preg_match('//u', $value) || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) fail(422, 'Please check ' . $field . '.');
    if (($required && $value === '') || strlen($value) > $limit) {
        fail(422, 'Please check ' . $field . '.');
    }
    return $value;
}

function phoneValue(array $data): string {
    $phone = textValue($data, 'phone', 25);
    if (!preg_match('/^\+?[0-9 ()-]{10,25}$/', $phone)) fail(422, 'Enter a valid phone number.');
    $digits = preg_replace('/\D/', '', $phone);
    if (strlen($digits) < 10 || strlen($digits) > 15) fail(422, 'Enter a valid phone number.');
    return $phone;
}

function rateLimit(string $scope, int $max, int $seconds): void {
    global $config;
    $address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = hash_hmac('sha256', $scope . '|' . $address, $config['secret']);
    $bucket = (int) floor(time() / $seconds);
    query('INSERT INTO rate_limits (rate_key, bucket, hits) VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE hits = hits + 1', [$key, $bucket]);
    $hits = query('SELECT hits FROM rate_limits WHERE rate_key = ? AND bucket = ?', [$key, $bucket])->fetchColumn();
    if ((int)$hits > $max) fail(429, 'Too many attempts. Please wait before trying again.');
    if (random_int(1, 100) === 1) query('DELETE FROM rate_limits WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 DAY)');
}

function currentStaff(): ?array {
    if (empty($_SESSION['staff_id']) || time() - ($_SESSION['last_seen'] ?? 0) > 1800 || time() - ($_SESSION['signed_in'] ?? 0) > 28800) return null;
    $staff = query('SELECT s.id,s.username,s.display_name,s.role,s.doctor_id,s.session_version,d.slug AS doctor_slug FROM staff_accounts s LEFT JOIN doctors d ON d.id=s.doctor_id WHERE s.id=? AND s.active=1', [$_SESSION['staff_id']])->fetch();
    if (!$staff || (int)$staff['session_version'] !== ($_SESSION['session_version'] ?? 0)) return null;
    return $staff;
}
function publicStaff(array $staff): array {
    return ['name'=>$staff['display_name'],'role'=>$staff['role'],'doctor'=>$staff['doctor_slug']];
}
function adminRequired(): void {
    global $viewer;
    $viewer = currentStaff();
    if (!$viewer) {unset($_SESSION['staff_id'],$_SESSION['admin']);fail(401,'Please sign in.');}
    $_SESSION['last_seen'] = time();
}
function manageDoctor(int $doctorId): void {
    global $viewer;
    if ($viewer['role'] !== 'reception' && (int)$viewer['doctor_id'] !== $doctorId) fail(403,'You can manage only your own appointments and schedule.');
}
function receptionOnly(): void {
    global $viewer;
    if ($viewer['role'] !== 'reception') fail(403,'Reception access is required.');
}
function scopeDoctor(array $data): string {
    global $viewer;
    $slug = textValue($data,'doctor',30,false);
    if ($viewer['role'] === 'doctor' && ($data['shared'] ?? false) !== true) {
        if ($slug !== '' && $slug !== $viewer['doctor_slug']) fail(403,'Use the shared view to view the other doctor’s appointments.');
        return $viewer['doctor_slug'];
    }
    if ($slug !== '') doctorValue($slug);
    return $slug;
}
function audit(string $action, ?int $target = null): void {
    global $viewer;
    query('INSERT INTO audit_log(staff_id,action,target_id) VALUES (?,?,?)',[$viewer['id'],$action,$target]);
}
function positiveId(array $data): int {
    $id=$data['id']??null;
    if (!is_int($id) || $id<1) fail(422,'Choose a valid record.');
    return $id;
}

function dateValue(string $value): DateTimeImmutable {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) fail(422, 'Choose a valid date.');
    return $date;
}

function doctorValue(string $slug, bool $lock = false): array {
    $doctor = query('SELECT id, slug, name, specialty FROM doctors WHERE slug = ? AND active = 1' . ($lock ? ' FOR UPDATE' : ''), [$slug])->fetch();
    if (!$doctor) fail(422, 'Choose a doctor.');
    return $doctor;
}

function slots(array $doctor, string $date): array {
    dateValue($date);
    $now = new DateTimeImmutable();
    $today = $now->format('Y-m-d');
    if ($date < $today || $date > $now->modify('+90 days')->format('Y-m-d')) return [];
    if (query('SELECT 1 FROM closed_dates WHERE doctor_id = ? AND closed_date = ?', [$doctor['id'], $date])->fetchColumn()) return [];
    $day = (int) dateValue($date)->format('w');
    $schedule = query('SELECT * FROM weekly_hours WHERE doctor_id = ? AND weekday = ?', [$doctor['id'], $day])->fetch();
    if (!$schedule || !$schedule['is_open']) return [];
    $taken = query('SELECT start_minute FROM reservations WHERE doctor_id = ? AND visit_date = ?', [$doctor['id'], $date])->fetchAll(PDO::FETCH_COLUMN);
    $result = [];
    for ($minute = (int)$schedule['start_minute']; $minute + 30 <= (int)$schedule['end_minute']; $minute += 30) {
        if ($date === $today && $minute <= (int)$now->format('G') * 60 + (int)$now->format('i')) continue;
        if (in_array($minute, $taken)) continue;
        $result[] = [
            'minute' => $minute,
            'label' => dateValue($date)->setTime(intdiv($minute, 60), $minute % 60)->format('g:i A'),
        ];
    }
    return $result;
}

function requestKey(array $data): string {
    $key = textValue($data, 'request_key', 64);
    if (!preg_match('/^[a-zA-Z0-9-]{20,64}$/', $key)) fail(422, 'Refresh the form and try again.');
    return $key;
}

function publicResponse(array $row): array {
    return [
        'reference' => $row['reference'],
        'status' => $row['status'],
        'date' => $row['visit_date'],
        'minute' => (int)$row['start_minute'],
    ];
}

function saveAppointment(array $data): array {
    global $db, $config;
    $name = textValue($data, 'name', 100);
    if (strlen($name)<2) fail(422,'Enter the patient’s full name.');
    $phone = phoneValue($data);
    $doctor = doctorValue(textValue($data, 'doctor', 30), true);
    $date = textValue($data, 'date', 10);
    dateValue($date);
    $minute = $data['minute'] ?? null;
    if (!is_int($minute) || $minute < 0 || $minute > 1410 || $minute % 30 !== 0) fail(422, 'Choose a time.');
    $visit = textValue($data, 'visit', 40);
    if (!in_array($visit, ['First consultation', 'Follow-up', 'Second opinion', 'Report review'], true)) fail(422, 'Choose a visit type.');
    $age = $data['age'] ?? null;
    if ($age === '') $age = null;
    if ($age !== null && (!is_int($age) || $age < 0 || $age > 120)) fail(422, 'Check the age.');
    $message = textValue($data, 'message', 2000, false);
    $key = requestKey($data);
    $fingerprint = hash_hmac('sha256', json_encode([$name, $phone, $doctor['slug'], $date, $minute, $visit, $age, $message]), $config['secret']);
    // The doctor row is locked by this transaction before checking or reserving a slot.
    $previous = query('SELECT * FROM appointments WHERE request_key = ?', [$key])->fetch();
    if ($previous) {
        if (!hash_equals($previous['fingerprint'], $fingerprint)) fail(409, 'Please refresh before making a different request.');
        return publicResponse($previous);
    }
    if (!in_array($minute, array_column(slots($doctor, $date), 'minute'), true)) fail(409, 'That time has just become unavailable. Choose another time.');
    $reference = 'ALT-' . strtoupper(bin2hex(random_bytes(6)));
    query('INSERT INTO appointments (reference, request_key, fingerprint, doctor_id, visit_date, start_minute, patient_name, phone, age, visit_type, concern, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [$reference, $key, $fingerprint, $doctor['id'], $date, $minute, $name, $phone, $age, $visit, $message, 'requested']);
    $id = $db->lastInsertId();
    query('INSERT INTO reservations (doctor_id, visit_date, start_minute, appointment_id) VALUES (?, ?, ?, ?)', [$doctor['id'], $date, $minute, $id]);
    return ['reference' => $reference, 'status' => 'requested', 'date' => $date, 'minute' => $minute];
}

$action = $_GET['action'] ?? '';
try {
    if ($action === 'bootstrap' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        respond(['csrf' => $_SESSION['csrf'], 'today' => date('Y-m-d'), 'max_date' => date('Y-m-d', strtotime('+90 days')), 'user' => ($staff = currentStaff()) ? publicStaff($staff) : null, 'doctors' => query('SELECT slug, name, specialty FROM doctors WHERE active = 1 ORDER BY id')->fetchAll()]);
    }
    if ($action === 'availability' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        rateLimit('availability', 240, 60);
        $doctor = doctorValue((string)($_GET['doctor'] ?? ''));
        $date = (string)($_GET['date'] ?? '');
        respond(['date' => $date, 'slots' => slots($doctor, $date), 'today' => date('Y-m-d')]);
    }
    if ($action === 'book') {
        $data = input();
        rateLimit('book', 12, 3600);
        if (!empty($data['website'])) fail(422, 'Please try again.');
        $db->beginTransaction();
        $result = saveAppointment($data);
        $db->commit();
        respond($result, 201);
    }
    if ($action === 'contact') {
        $data = input();
        rateLimit('contact', 8, 3600);
        if (!empty($data['website'])) fail(422, 'Please try again.');
        $name = textValue($data, 'name', 100);
        $phone = phoneValue($data);
        $message = textValue($data, 'message', 2000);
        $key = requestKey($data);
        $previous = query('SELECT * FROM enquiries WHERE request_key = ?', [$key])->fetch();
        if ($previous) {
            if ($previous['patient_name'] !== $name || $previous['phone'] !== $phone || $previous['message'] !== $message) fail(409, 'Refresh before sending a different enquiry.');
            respond(['reference' => $previous['reference']]);
        }
        $reference = 'ENQ-' . strtoupper(bin2hex(random_bytes(6)));
        query('INSERT INTO enquiries (reference, request_key, patient_name, phone, message) VALUES (?, ?, ?, ?, ?)', [$reference, $key, $name, $phone, $message]);
        respond(['reference' => $reference], 201);
    }
    if ($action === 'login') {
        $data = input();
        rateLimit('login', 40, 900);
        $user = textValue($data, 'username', 100);
        $password = textValue($data, 'password', 128);
        rateLimit('login-account-'.strtolower($user),12,900);
        $staff = query('SELECT s.*,d.slug AS doctor_slug FROM staff_accounts s LEFT JOIN doctors d ON d.id=s.doctor_id WHERE s.username=? AND s.active=1',[$user])->fetch();
        $dummy = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $valid = password_verify($password,$staff['password_hash'] ?? $dummy);
        if (!$staff || !$valid) fail(401,'Incorrect username or password.');
        $workspace=textValue($data,'workspace',30,false);
        if ($workspace!=='' && !in_array($workspace,['chetan','mounika'],true)) fail(422,'Choose a valid doctor workspace.');
        if ($workspace!=='' && ($staff['role']!=='doctor' || $staff['doctor_slug']!==$workspace)) fail(403,'Sign in with the account belonging to this doctor.');
        session_regenerate_id(true);
        $_SESSION['staff_id']=(int)$staff['id'];
        $_SESSION['session_version']=(int)$staff['session_version'];
        $_SESSION['last_seen']=time();$_SESSION['signed_in']=time();
        $_SESSION['csrf']=bin2hex(random_bytes(24));
        respond(['csrf'=>$_SESSION['csrf'],'user'=>publicStaff($staff)]);
    }
    if (str_starts_with($action, 'admin-')) {
        adminRequired();
        if ($action === 'admin-data' && $_SERVER['REQUEST_METHOD'] === 'GET') {
            $date = (string)($_GET['date'] ?? date('Y-m-d'));
            dateValue($date);
            $doctorFilter = $viewer['role']==='doctor' ? ' AND d.id='.(int)$viewer['doctor_id'] : '';
            respond([
                'appointments'=>query('SELECT a.id,a.reference,a.visit_date,a.start_minute,a.patient_name,a.phone,a.age,a.visit_type,a.concern,a.status,d.name AS doctor FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.visit_date=?'.$doctorFilter.' ORDER BY a.start_minute,a.id',[$date])->fetchAll(),
                'enquiries'=>$viewer['role']==='reception' ? query('SELECT id,reference,patient_name,phone,message,is_resolved,created_at FROM enquiries ORDER BY id DESC LIMIT 100')->fetchAll() : [],
                'hours'=>query('SELECT d.slug,h.weekday,h.is_open,h.start_minute,h.end_minute FROM weekly_hours h JOIN doctors d ON d.id=h.doctor_id WHERE 1=1'.$doctorFilter.' ORDER BY d.id,h.weekday')->fetchAll(),
                'closures'=>query('SELECT d.slug,c.closed_date FROM closed_dates c JOIN doctors d ON d.id=c.doctor_id WHERE c.closed_date>=CURRENT_DATE'.$doctorFilter.' ORDER BY c.closed_date')->fetchAll(),
            ]);
        }

        $data = input();
        if ($action === 'admin-reception-password') {
            if ($viewer['role']!=='doctor') fail(403,'Only doctors can reset the reception password.');
            $current=textValue($data,'current_password',128);
            $new=textValue($data,'new_password',128);
            if (strlen($new)<10) fail(422,'Use at least 10 characters for the reception password.');
            rateLimit('reception-password-'.$viewer['id'],6,900);
            $ownHash=query('SELECT password_hash FROM staff_accounts WHERE id=?',[$viewer['id']])->fetchColumn();
            if (!password_verify($current,$ownHash)) fail(422,'Your current doctor password is incorrect.');
            $db->beginTransaction();
            $reception=query("SELECT id,password_hash FROM staff_accounts WHERE role='reception' AND active=1 FOR UPDATE")->fetchAll();
            if (count($reception)!==1) fail(409,'Contact the site owner to select the reception account.');
            $target=$reception[0];
            if (password_verify($new,$target['password_hash'])) fail(422,'Choose a different reception password.');
            query('UPDATE staff_accounts SET password_hash=?,session_version=session_version+1 WHERE id=?',[password_hash($new,PASSWORD_DEFAULT),$target['id']]);
            audit('account.reception-password',(int)$target['id']);$db->commit();
            respond(['ok'=>true]);
        }
        if ($action === 'admin-password') {
            if ($viewer['role'] !== 'doctor') fail(403,'Only doctors can change their password from this dashboard.');
            $old=textValue($data,'current_password',128);$new=textValue($data,'new_password',128);
            if (strlen($new)<10 || $old===$new) fail(422,'Use a different password of at least 10 characters.');
            $hash=query('SELECT password_hash FROM staff_accounts WHERE id=?',[$viewer['id']])->fetchColumn();
            rateLimit('password-'.$viewer['id'],6,900);
            if (!password_verify($old,$hash)) fail(422,'The current password is incorrect.');
            $db->beginTransaction();
            query('UPDATE staff_accounts SET password_hash=?,session_version=session_version+1 WHERE id=?',[password_hash($new,PASSWORD_DEFAULT),$viewer['id']]);
            audit('account.password');$db->commit();
            $_SESSION['session_version']=(int)query('SELECT session_version FROM staff_accounts WHERE id=?',[$viewer['id']])->fetchColumn();
            session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(24));respond(['csrf'=>$_SESSION['csrf']]);
        }
        if ($action === 'admin-analytics') {
            $from=textValue($data,'from',10);$to=textValue($data,'to',10);
            $start=dateValue($from);$end=dateValue($to);
            if ($to<$from || $start->diff($end)->days>366) fail(422,'Choose a date range of up to one year.');
            $slug=scopeDoctor($data);$where='a.visit_date BETWEEN ? AND ?';$params=[$from,$to];
            if ($slug!=='') {$where.=' AND d.slug=?';$params[]=$slug;}
            $join=' FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE '.$where;
            $daily=query("SELECT a.visit_date,COUNT(*) AS total,SUM(a.status='completed') AS completed,SUM(a.status='cancelled') AS cancelled".$join.' GROUP BY a.visit_date ORDER BY a.visit_date',$params)->fetchAll();
            $status=query('SELECT a.status,COUNT(*) AS total'.$join.' GROUP BY a.status',$params)->fetchAll();
            $byDoctor=query("SELECT d.name,d.slug,COUNT(*) AS total,SUM(a.status='completed') AS completed".$join.' GROUP BY d.id,d.name,d.slug',$params)->fetchAll();
            $types=query('SELECT a.visit_type,COUNT(*) AS total'.$join.' GROUP BY a.visit_type',$params)->fetchAll();
            $patients=(int)query("SELECT COUNT(*) FROM (SELECT a.patient_name,a.phone".$join." AND a.status<>'cancelled' GROUP BY a.patient_name,a.phone) patient_groups",$params)->fetchColumn();
            respond(['daily'=>$daily,'status'=>$status,'doctors'=>$byDoctor,'visit_types'=>$types,'patients'=>$patients]);
        }
        if ($action === 'admin-list') {
            $from = textValue($data, 'from', 10);
            $to = textValue($data, 'to', 10);
            $start = dateValue($from); $end = dateValue($to);
            if ($to < $from || $start->diff($end)->days > 366) fail(422, 'Choose a date range of up to one year.');
            $where = ['a.visit_date BETWEEN ? AND ?']; $params = [$from, $to];
            $slug = scopeDoctor($data);
            if ($slug !== '') {doctorValue($slug); $where[] = 'd.slug = ?'; $params[] = $slug;}
            $status = textValue($data, 'status', 20, false);
            if ($status !== '') {
                if (!in_array($status, ['requested','confirmed','completed','cancelled'], true)) fail(422, 'Choose a valid status.');
                $where[] = 'a.status = ?'; $params[] = $status;
            }
            $search = textValue($data, 'search', 100, false);
            if ($search !== '') {
                $where[] = '(a.patient_name LIKE ? OR a.phone LIKE ? OR a.reference LIKE ?)';
                array_push($params, '%'.$search.'%', '%'.$search.'%', '%'.$search.'%');
            }
            $clause = implode(' AND ', $where);
            $page = $data['page'] ?? 1; if (!is_int($page) || $page<1 || $page>100000) fail(422,'Choose a valid page.'); $offset = ($page - 1) * 25;
            $total = (int)query('SELECT COUNT(*) FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE '.$clause, $params)->fetchColumn();
            $rows = query('SELECT a.id,a.reference,a.visit_date,a.start_minute,a.patient_name,a.phone,a.age,a.visit_type,a.concern,a.status,d.slug AS doctor_slug,d.name AS doctor FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE '.$clause.' ORDER BY a.visit_date,a.start_minute,a.id LIMIT 25 OFFSET '.$offset, $params)->fetchAll();
            $summaryParams = [$from,$to]; $summaryWhere = 'a.visit_date BETWEEN ? AND ?';
            if ($slug !== '') {$summaryWhere .= ' AND d.slug = ?'; $summaryParams[] = $slug;}
            $summary = query('SELECT a.status,COUNT(*) AS total FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE '.$summaryWhere.' GROUP BY a.status', $summaryParams)->fetchAll();
            respond(['appointments'=>$rows,'total'=>$total,'page'=>$page,'summary'=>$summary,'enquiries_unresolved'=>$viewer['role']==='reception'?(int)query('SELECT COUNT(*) FROM enquiries WHERE is_resolved=0')->fetchColumn():null]);
        }
        if ($action === 'admin-history') {
            $name = textValue($data, 'name', 100); $phone = phoneValue($data);
            // Shared family numbers must not merge patients with different names.
            $phoneDigits = preg_replace('/\D/', '', $phone);
            $historyScope = $viewer['role']==='doctor' && ($data['shared']??false)!==true ? ' AND a.doctor_id='.(int)$viewer['doctor_id'] : '';
            $rows = query("SELECT a.reference,a.visit_date,a.start_minute,a.visit_type,a.concern,a.status,d.name AS doctor FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.patient_name = ? AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(a.phone,'+',''),' ',''),'-',''),'(',''),')','') = ? ".$historyScope." ORDER BY a.visit_date DESC,a.start_minute DESC LIMIT 200", [$name,$phoneDigits])->fetchAll();
            respond(['visits'=>$rows]);
        }
        if ($action === 'admin-create') {
            $targetDoctor=doctorValue(textValue($data,'doctor',30));manageDoctor((int)$targetDoctor['id']);
            $db->beginTransaction(); $result = saveAppointment($data);
            audit('appointment.create',(int)query('SELECT id FROM appointments WHERE reference=?',[$result['reference']])->fetchColumn());
            // Reception creates a requested booking; use Confirm after verifying details.
            $db->commit(); respond($result,201);
        }
        if ($action === 'admin-reschedule') {
            $id = positiveId($data); $date = textValue($data,'date',10); dateValue($date);
            $minute = $data['minute'] ?? null;
            if (!is_int($minute) || $minute < 0 || $minute > 1410 || $minute % 30) fail(422,'Choose a valid time.');
            $row = query('SELECT d.slug FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.id=?',[$id])->fetch();
            if (!$row) fail(404,'Appointment not found.');
            $targetDoctor=doctorValue($row['slug']);manageDoctor((int)$targetDoctor['id']);
            $db->beginTransaction(); $doctor = doctorValue($row['slug'],true);
            $current = query('SELECT * FROM appointments WHERE id=? FOR UPDATE',[$id])->fetch();
            if (!in_array($current['status'],['requested','confirmed'],true)) fail(409,'Only pending or confirmed appointments can be rescheduled.');
            if (($data['expected_date'] ?? '') !== $current['visit_date'] || ($data['expected_minute'] ?? null) !== (int)$current['start_minute']) fail(409,'This appointment changed. Refresh before rescheduling.');
            if ($date === $current['visit_date'] && $minute === (int)$current['start_minute']) {$db->commit(); respond(['ok'=>true]);}
            if (!in_array($minute,array_column(slots($doctor,$date),'minute'),true)) fail(409,'That time is no longer available. Choose another time.');
            query('DELETE FROM reservations WHERE appointment_id=?',[$id]);
            query('INSERT INTO reservations (doctor_id,visit_date,start_minute,appointment_id) VALUES (?,?,?,?)',[$doctor['id'],$date,$minute,$id]);
            query('UPDATE appointments SET visit_date=?,start_minute=? WHERE id=?',[$date,$minute,$id]);
            audit('appointment.reschedule',$id);$db->commit();respond(['ok'=>true]);
        }
        if ($action === 'admin-logout') {
            audit('account.logout');
            $_SESSION = [];
            session_destroy();
            respond(['ok' => true]);
        }
        if ($action === 'admin-status') {
            $id = positiveId($data);
            $status = textValue($data, 'status', 20);
            $row = query('SELECT doctor_id FROM appointments WHERE id = ?', [$id])->fetch();
            if (!$row) fail(404, 'Appointment not found.');
            manageDoctor((int)$row['doctor_id']);
            $db->beginTransaction();
            query('SELECT id FROM doctors WHERE id = ? FOR UPDATE', [$row['doctor_id']])->fetch();
            $current = query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [$id])->fetch();
            $allowed = ['requested' => ['confirmed', 'cancelled'], 'confirmed' => ['completed', 'cancelled'], 'cancelled' => [], 'completed' => []];
            if ($current['status'] !== $status && !in_array($status, $allowed[$current['status']], true)) fail(409, 'This appointment changed. Refresh the dashboard.');
            query('UPDATE appointments SET status = ? WHERE id = ?', [$status, $id]);
            if ($status === 'cancelled') query('DELETE FROM reservations WHERE appointment_id = ?', [$id]);
            audit('appointment.'.$status,$id);
            $db->commit();
            respond(['ok' => true]);
        }
        if ($action === 'admin-hours') {
            $slug = textValue($data, 'doctor', 30);
            $hours = $data['hours'] ?? [];
            if (!is_array($hours) || count($hours) !== 7) fail(422, 'Provide all seven days.');
            $db->beginTransaction();
            $doctor = doctorValue($slug, true);manageDoctor((int)$doctor['id']);
            foreach (array_values($hours) as $day => $row) {
                if (!is_array($row)) fail(422, 'Check weekly hours.');
                $start = $row['start'] ?? null;
                $end = $row['end'] ?? null;
                $open = $row['open'] ?? null;
                if (!is_int($start) || !is_int($end) || !is_bool($open) || $start < 0 || $end > 1440 || $start >= $end || $start % 30 || $end % 30) fail(422, 'Choose valid half-hour opening and closing times.');
                query('UPDATE weekly_hours SET is_open = ?, start_minute = ?, end_minute = ? WHERE doctor_id = ? AND weekday = ?', [(int)$open, $start, $end, $doctor['id'], $day]);
            }
            audit('schedule.hours',(int)$doctor['id']);$db->commit();
            respond(['ok' => true, 'message' => 'Hours saved. Existing appointments remain reserved.']);
        }
        if ($action === 'admin-closure') {
            $date = textValue($data, 'date', 10);
            dateValue($date);
            if ($date < date('Y-m-d')) fail(422, 'Choose today or a future date.');
            $db->beginTransaction();
            $doctor = doctorValue(textValue($data, 'doctor', 30), true);manageDoctor((int)$doctor['id']);
            if (($data['closed'] ?? null) === true) {
                query('INSERT IGNORE INTO closed_dates (doctor_id, closed_date) VALUES (?, ?)', [$doctor['id'], $date]);
            } elseif (($data['closed'] ?? null) === false) {
                query('DELETE FROM closed_dates WHERE doctor_id = ? AND closed_date = ?', [$doctor['id'], $date]);
            } else fail(422, 'Choose whether to close or reopen the date.');
            audit('schedule.closure',(int)$doctor['id']);$db->commit();
            respond(['ok' => true, 'message' => 'Availability updated. Contact patients separately about existing appointments.']);
        }
        if ($action === 'admin-enquiry') {
            receptionOnly();$id=positiveId($data);
            if (!is_bool($data['resolved']??null)) fail(422,'Choose an enquiry status.');
            query('UPDATE enquiries SET is_resolved = ? WHERE id = ?', [!empty($data['resolved']) ? 1 : 0, $id]);
            audit('enquiry.update',$id);
            respond(['ok' => true]);
        }
    }
    fail(404, 'Unknown action.');
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    if ($error instanceof PDOException && ($error->errorInfo[1] ?? 0) === 1062) fail(409, 'This request changed or the time was reserved. Refresh and try again.');
    error_log('Altus API failure: ' . get_class($error));
    fail(500, 'We could not save that request. Please retry or call the clinic.');
}
