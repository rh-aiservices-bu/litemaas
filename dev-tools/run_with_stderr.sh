#!/bin/bash
# Simple wrapper script to work around bash tool stderr redirection bug
# Usage: ./scripts/run_with_stderr.sh command args...
exec "$@" 2>&1