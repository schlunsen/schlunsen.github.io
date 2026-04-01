# Justfile for schlunsen.github.io

# Serve the site locally
serve:
    python3 -m http.server 8000

# Serve on a custom port
serve-port port="8000":
    python3 -m http.server {{port}}

# Kill any existing dev server on port 8000
kill:
    -lsof -ti:8000 | xargs kill -9 2>/dev/null
    @echo "Dev server stopped"

# Open in browser and serve
dev:
    #!/usr/bin/env bash
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    python3 -m http.server 8000 &
    sleep 1
    open http://localhost:8000
    wait
