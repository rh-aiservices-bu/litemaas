#!/bin/sh
set -e

# Default backend URL if not provided
: ${BACKEND_URL:=http://backend:8080}

# Set the APP_ROOT if not already set (standard in Red Hat images)
: ${APP_ROOT:=/opt/app-root}

# Export BACKEND_URL to ensure it's available to envsubst
export BACKEND_URL

echo "Configuring nginx with BACKEND_URL=${BACKEND_URL}"

# Use the Red Hat nginx container's configuration path
# The nginx.default.d directory is writable by the default user
mkdir -p ${APP_ROOT}/etc/nginx.default.d

# Debug: Show template content before substitution
echo "Template content before substitution:"
cat /tmp/nginx.conf.template

# Substitute environment variables in the template
envsubst '${BACKEND_URL}' < /tmp/nginx.conf.template > ${APP_ROOT}/etc/nginx.default.d/default.conf

echo "Nginx configuration after substitution:"
cat ${APP_ROOT}/etc/nginx.default.d/default.conf

# The Red Hat nginx container handles starting nginx automatically
# We just need to exec the run script provided by the base image
exec /usr/libexec/s2i/run