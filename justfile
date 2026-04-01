# Justfile for schlunsen.github.io

# Serve the site locally
serve:
    python3 -m http.server 8000

# Serve on a custom port
serve-port port="8000":
    python3 -m http.server {{port}}

# Open in browser and serve
dev:
    #!/usr/bin/env bash
    python3 -m http.server 8000 &
    sleep 1
    open http://localhost:8000
    wait
