#!/usr/bin/env python3
"""Signed, read-only business health probe. Never emit the key or response data."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import shlex
import sys
import time
import urllib.request


def main():
    if len(sys.argv) > 1:
        env = {}
        for line in Path(sys.argv[1]).read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                parts = shlex.split(value, comments=False)
                env[key.strip()] = ' '.join(parts)
    else:
        env = os.environ
    secret = env['JWT_SECRET_KEY']
    stamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), ('yueji-release-readiness:v1:'+stamp).encode(), hashlib.sha256).hexdigest()
    url = 'http://127.0.0.1:'+env.get('APP_PORT', env.get('SERVER_PORT', '8000'))+'/api/v1/internal/readiness'
    request = urllib.request.Request(url, headers={'x-readiness-time': stamp, 'x-readiness-signature': signature})
    with urllib.request.urlopen(request, timeout=20) as response:
        body = json.load(response)
        assert response.status == 200 and body.get('code') == '00000' and body.get('data', {}).get('ready') is True
    print('BUSINESS_READINESS_OK')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('BUSINESS_READINESS_FAILED', file=sys.stderr)
        sys.exit(1)
