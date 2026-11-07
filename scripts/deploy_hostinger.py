"""Upload only the public build. Never run database migrations during deployment."""
import os
from pathlib import Path
import re
import subprocess
import tempfile


def settings():
    names = ['HOSTINGER_HOST', 'HOSTINGER_PORT', 'HOSTINGER_USER', 'HOSTINGER_SSH_KEY',
             'HOSTINGER_KNOWN_HOSTS', 'HOSTINGER_DEPLOY_PATH']
    values = {name: os.environ.get(name, '').strip() for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise ValueError('Add these GitHub environment secrets: ' + ', '.join(missing))
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*', values['HOSTINGER_HOST']):
        raise ValueError('Invalid SSH host')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', values['HOSTINGER_USER']):
        raise ValueError('Invalid SSH username')
    if not values['HOSTINGER_PORT'].isdigit() or not 1 <= int(values['HOSTINGER_PORT']) <= 65535:
        raise ValueError('Invalid SSH port')
    expected = '/home/' + values['HOSTINGER_USER'] + '/domains/altusentkidneycare.com/public_html'
    if values['HOSTINGER_DEPLOY_PATH'].rstrip('/') != expected:
        raise ValueError('Deployment path must be the Altus domain public_html: ' + expected)
    return values


def validate_build():
    root = Path('dist')
    for required in ['index.html', 'assets/js/booking.js', 'api/index.php', 'admin/index.html']:
        if not (root / required).is_file():
            raise ValueError('Incomplete build: ' + required)
    for path in root.rglob('*'):
        if path.is_symlink():
            raise ValueError('Build must not contain symbolic links')
        if path.is_file() and (path.suffix.lower() in ['.sql', '.zip', '.env', '.pdf', '.log']
                               or path.name in ['config.php', 'config.example.php']):
            raise ValueError('Private or unexpected file in public build: ' + str(path))


def deploy():
    config = settings()
    validate_build()
    with tempfile.TemporaryDirectory(prefix='altus-deploy-') as directory:
        key = Path(directory) / 'key'
        known = Path(directory) / 'known_hosts'
        key.write_text(config['HOSTINGER_SSH_KEY'] + '\n', encoding='utf-8')
        key.chmod(0o600)
        known.write_text(config['HOSTINGER_KNOWN_HOSTS'] + '\n', encoding='utf-8')
        options = ['-i', str(key), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
                   '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + str(known),
                   '-o', 'ConnectTimeout=30']
        remote = config['HOSTINGER_USER'] + '@' + config['HOSTINGER_HOST']
        target = config['HOSTINGER_DEPLOY_PATH'].rstrip('/')
        # Paths are validated above; require the existing public_html directory.
        # No deletion or SQL execution: private config and patient data remain separate.
        subprocess.run(['ssh', *options, '-p', config['HOSTINGER_PORT'], remote,
                        'test -d ' + target], check=True)
        subprocess.run(['scp', *options, '-P', config['HOSTINGER_PORT'], '-r',
                        'dist/.', remote + ':' + target + '/'], check=True)
    print('Public website uploaded. Database and private configuration were not modified.')


if __name__ == '__main__':
    deploy()
