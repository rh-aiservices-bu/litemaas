{{/*
Expand the name of the chart.
*/}}
{{- define "litemaas.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "litemaas.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "litemaas.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Component fullnames
*/}}
{{- define "litemaas.postgresql.fullname" -}}
{{- printf "%s-postgresql" (include "litemaas.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "litemaas.litellm.fullname" -}}
{{- printf "%s-litellm" (include "litemaas.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "litemaas.backend.fullname" -}}
{{- printf "%s-backend" (include "litemaas.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "litemaas.frontend.fullname" -}}
{{- printf "%s" (include "litemaas.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "litemaas.redis.fullname" -}}
{{- printf "%s-redis" (include "litemaas.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Redis host — auto-constructed when built-in Redis is enabled,
otherwise must be provided explicitly via backend.redis.host.
Returns empty string if Redis is not configured.
*/}}
{{- define "litemaas.redis.host" -}}
{{- if .Values.backend.redis.host }}
{{- .Values.backend.redis.host }}
{{- else if .Values.redis.enabled }}
{{- include "litemaas.redis.fullname" . }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "litemaas.labels" -}}
helm.sh/chart: {{ include "litemaas.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ include "litemaas.name" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end }}

{{/*
Component labels — call with dict "context" $ "component" "backend"
*/}}
{{- define "litemaas.componentLabels" -}}
{{ include "litemaas.labels" .context }}
{{ include "litemaas.componentSelectorLabels" (dict "context" .context "component" .component) }}
{{- end }}

{{/*
Selector labels for a component
*/}}
{{- define "litemaas.componentSelectorLabels" -}}
app.kubernetes.io/name: {{ include "litemaas.name" .context }}
app.kubernetes.io/instance: {{ .context.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/* ========== ServiceAccount ========== */}}

{{- define "litemaas.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "litemaas.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* ========== Secret name helpers ========== */}}

{{- define "litemaas.postgresql.secretName" -}}
{{- if .Values.postgresql.auth.existingSecret }}
{{- .Values.postgresql.auth.existingSecret }}
{{- else }}
{{- include "litemaas.postgresql.fullname" . }}
{{- end }}
{{- end }}

{{- define "litemaas.litellm.secretName" -}}
{{- if .Values.litellm.auth.existingSecret }}
{{- .Values.litellm.auth.existingSecret }}
{{- else }}
{{- include "litemaas.litellm.fullname" . }}
{{- end }}
{{- end }}

{{- define "litemaas.backend.secretName" -}}
{{- if .Values.backend.auth.existingSecret }}
{{- .Values.backend.auth.existingSecret }}
{{- else }}
{{- include "litemaas.backend.fullname" . }}
{{- end }}
{{- end }}

{{/* ========== Cluster domain auto-detection ========== */}}

{{/*
Cluster domain — returns global.clusterDomain if set, otherwise uses lookup
to query the OpenShift Ingress config for the apps domain.
The lookup requires cluster-level read access to config.openshift.io/v1 Ingress.
Set global.clusterScopedLookups=false and global.clusterDomain explicitly
when deploying without cluster-admin privileges.
Returns empty string on non-OpenShift clusters or during helm template.
*/}}
{{- define "litemaas.clusterDomain" -}}
{{- if .Values.global.clusterDomain }}
{{- .Values.global.clusterDomain }}
{{- else if and (eq .Values.global.platform "openshift") .Values.global.clusterScopedLookups }}
{{- $ingress := (lookup "config.openshift.io/v1" "Ingress" "" "cluster") }}
{{- if and $ingress $ingress.spec $ingress.spec.domain }}
{{- $ingress.spec.domain }}
{{- end }}
{{- end }}
{{- end }}

{{/* ========== OAuth helpers ========== */}}

{{/*
OAuth token secret name — the Secret that holds the SA token.
*/}}
{{- define "litemaas.oauth.tokenSecretName" -}}
{{- if .Values.oauth.existingTokenSecret }}
{{- .Values.oauth.existingTokenSecret }}
{{- else }}
{{- printf "%s-oauth-token" (include "litemaas.fullname" .) }}
{{- end }}
{{- end }}

{{/*
OAuth issuer URL — explicit value, or auto-constructed from cluster domain.
*/}}
{{- define "litemaas.oauth.issuer" -}}
{{- if eq .Values.oauth.mode "external" }}
{{- .Values.backend.auth.oauthIssuer }}
{{- else if .Values.oauth.issuer }}
{{- .Values.oauth.issuer }}
{{- else }}
{{- $domain := include "litemaas.clusterDomain" . }}
{{- if $domain }}
{{- printf "https://oauth-openshift.%s" $domain }}
{{- end }}
{{- end }}
{{- end }}

{{/*
OAuth client ID — SA-based or external.
*/}}
{{- define "litemaas.oauth.clientId" -}}
{{- if eq .Values.oauth.mode "external" }}
{{- .Values.backend.auth.oauthClientId }}
{{- else }}
{{- printf "system:serviceaccount:%s:%s" .Release.Namespace (include "litemaas.serviceAccountName" .) }}
{{- end }}
{{- end }}

{{/*
OAuth client secret — for external mode, use the explicit value.
For serviceaccount mode, this is read from the SA token secret at runtime
(see backend-deployment.yaml), so the backend-secret stores a placeholder.
*/}}
{{- define "litemaas.oauth.clientSecret" -}}
{{- if eq .Values.oauth.mode "external" }}
{{- .Values.backend.auth.oauthClientSecret }}
{{- else }}
{{- printf "" }}
{{- end }}
{{- end }}

{{/* ========== Deployer / initial-admin helpers ========== */}}

{{/*
Deployer username — on OpenShift, looks up the current user via the API.
Returns empty string on non-OpenShift clusters or during helm template.
*/}}
{{- define "litemaas.deployer.username" -}}
{{- if eq .Values.global.platform "openshift" }}
{{- $user := (lookup "user.openshift.io/v1" "User" "" "~") }}
{{- if and $user $user.metadata $user.metadata.name }}
{{- $user.metadata.name }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Initial admin users — explicit value, or auto-detected deployer on OpenShift.
*/}}
{{- define "litemaas.initialAdminUsers" -}}
{{- if .Values.backend.auth.initialAdminUsers }}
{{- .Values.backend.auth.initialAdminUsers }}
{{- else }}
{{- include "litemaas.deployer.username" . }}
{{- end }}
{{- end }}

{{/* ========== URL construction helpers ========== */}}

{{/*
PostgreSQL host — internal service name when co-deployed.
*/}}
{{- define "litemaas.postgresql.host" -}}
{{- include "litemaas.postgresql.fullname" . }}
{{- end }}

{{/*
Backend database URL — auto-constructed when PostgreSQL is co-deployed,
otherwise must be provided explicitly via backend.databaseUrl.
*/}}
{{- define "litemaas.backend.databaseUrl" -}}
{{- if .Values.backend.databaseUrl }}
{{- .Values.backend.databaseUrl }}
{{- else if .Values.postgresql.enabled }}
{{- printf "postgresql://%s:%s@%s:5432/litemaas_db?sslmode=disable" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "litemaas.postgresql.host" .) }}
{{- else }}
{{- fail "backend.databaseUrl is required when postgresql.enabled is false" }}
{{- end }}
{{- end }}

{{/*
LiteLLM database URL — auto-constructed when PostgreSQL is co-deployed,
otherwise must be provided explicitly via litellm.databaseUrl.
*/}}
{{- define "litemaas.litellm.databaseUrl" -}}
{{- if .Values.litellm.databaseUrl }}
{{- .Values.litellm.databaseUrl }}
{{- else if .Values.postgresql.enabled }}
{{- printf "postgresql://%s:%s@%s:5432/litellm_db" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "litemaas.postgresql.host" .) }}
{{- else }}
{{- fail "litellm.databaseUrl is required when postgresql.enabled is false" }}
{{- end }}
{{- end }}

{{/*
LiteLLM URL — used by the backend for API calls and shown to users in the UI.
Prefers the external Route/Ingress URL when available so that users see a
reachable endpoint; falls back to the internal ClusterIP service URL.
*/}}
{{- define "litemaas.litellm.url" -}}
{{- if .Values.backend.litellmApiUrl }}
{{- /* 1. Explicit override — always wins */ -}}
{{- .Values.backend.litellmApiUrl }}
{{- else if and (eq .Values.global.platform "kubernetes") .Values.ingress.enabled .Values.ingress.litellm.enabled .Values.ingress.litellm.host }}
{{- /* 2. Kubernetes Ingress with host */ -}}
{{- if .Values.ingress.litellm.tls }}
{{- printf "https://%s" .Values.ingress.litellm.host }}
{{- else }}
{{- printf "http://%s" .Values.ingress.litellm.host }}
{{- end }}
{{- else if and (eq .Values.global.platform "openshift") .Values.route.enabled .Values.route.litellm.enabled .Values.route.litellm.host }}
{{- /* 3. OpenShift Route with explicit host */ -}}
{{- printf "https://%s" .Values.route.litellm.host }}
{{- else if and (eq .Values.global.platform "openshift") .Values.route.enabled .Values.route.litellm.enabled }}
{{- /* 4. OpenShift Route with auto-generated host — try clusterDomain */ -}}
{{- $domain := include "litemaas.clusterDomain" . }}
{{- if $domain }}
{{- printf "https://%s-%s.%s" (include "litemaas.litellm.fullname" .) .Release.Namespace $domain }}
{{- else }}
{{- /* clusterDomain unknown at template time — post-install hook will patch */ -}}
{{- printf "http://%s:4000" (include "litemaas.litellm.fullname" .) }}
{{- end }}
{{- else if .Values.litellm.enabled }}
{{- /* 5. No external exposure — internal ClusterIP service */ -}}
{{- printf "http://%s:4000" (include "litemaas.litellm.fullname" .) }}
{{- else }}
{{- fail "backend.litellmApiUrl is required when litellm.enabled is false" }}
{{- end }}
{{- end }}

{{/*
Backend internal URL — used by frontend to reach backend.
*/}}
{{- define "litemaas.backend.url" -}}
{{- if .Values.frontend.backendUrl }}
{{- .Values.frontend.backendUrl }}
{{- else }}
{{- printf "http://%s:8080" (include "litemaas.backend.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Frontend hostname — derived from ingress/route config, or auto-constructed
from the cluster domain on OpenShift.
*/}}
{{- define "litemaas.frontend.hostname" -}}
{{- if and (eq .Values.global.platform "kubernetes") .Values.ingress.enabled .Values.ingress.frontend.host }}
{{- .Values.ingress.frontend.host }}
{{- else if and (eq .Values.global.platform "openshift") .Values.route.enabled .Values.route.frontend.host }}
{{- .Values.route.frontend.host }}
{{- else if and (eq .Values.global.platform "openshift") .Values.route.enabled }}
{{- $domain := include "litemaas.clusterDomain" . }}
{{- if $domain }}
{{- printf "%s-%s.%s" (include "litemaas.frontend.fullname" .) .Release.Namespace $domain }}
{{- end }}
{{- end }}
{{- end }}

{{/*
CORS origin — derived from the frontend hostname, or explicitly set.
*/}}
{{- define "litemaas.backend.corsOrigin" -}}
{{- if .Values.backend.corsOrigin }}
{{- .Values.backend.corsOrigin }}
{{- else }}
{{- $hostname := include "litemaas.frontend.hostname" . }}
{{- if $hostname }}
{{- printf "https://%s" $hostname }}
{{- else }}
{{- printf "*" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
OAuth callback URL — derived from the frontend hostname, or explicitly set.
*/}}
{{- define "litemaas.backend.oauthCallbackUrl" -}}
{{- if .Values.backend.auth.oauthCallbackUrl }}
{{- .Values.backend.auth.oauthCallbackUrl }}
{{- else }}
{{- $hostname := include "litemaas.frontend.hostname" . }}
{{- if $hostname }}
{{- printf "https://%s/api/auth/callback" $hostname }}
{{- else }}
{{- printf "" }}
{{- end }}
{{- end }}
{{- end }}

{{/* ========== Init container snippets ========== */}}

{{/*
Wait-for-database init container.
Call with dict "context" $ "secretName" "xxx" "secretKey" "database-url"
*/}}
{{- define "litemaas.initWaitForDatabase" -}}
- name: wait-for-database
  image: {{ .context.Values.postgresql.image.repository }}:{{ .context.Values.postgresql.image.tag }}
  {{- if eq .context.Values.global.platform "openshift" }}
  securityContext:
    allowPrivilegeEscalation: false
    capabilities:
      drop: [ALL]
  {{- end }}
  command:
    - sh
    - -c
    - |
      until psql "$DATABASE_URL" -c '\q' 2>/dev/null; do
        echo "Waiting for database..."
        sleep 2
      done
      echo "Database is ready!"
  env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: {{ .secretName }}
          key: {{ .secretKey }}
  resources:
    requests:
      memory: "64Mi"
      cpu: "25m"
    limits:
      memory: "128Mi"
      cpu: "100m"
{{- end }}

{{/*
Wait-for-backend init container (frontend).
Uses busybox on Kubernetes, OpenShift tools image on OpenShift.
*/}}
{{- define "litemaas.initWaitForBackend" -}}
- name: wait-for-backend
  {{- if eq .Values.global.platform "openshift" }}
  image: image-registry.openshift-image-registry.svc:5000/openshift/tools:latest
  {{- else }}
  image: busybox:1.36
  {{- end }}
  command: ['sh', '-c']
  args:
    - |
      echo "Waiting for backend to be ready..."
      until nc -z {{ include "litemaas.backend.fullname" . }} 8080; do
        echo "Backend is not ready yet. Waiting..."
        sleep 5
      done
      echo "Backend is ready! Starting frontend..."
  resources:
    requests:
      memory: "64Mi"
      cpu: "25m"
    limits:
      memory: "128Mi"
      cpu: "100m"
{{- end }}
