#!/usr/bin/env bash
# Diagnóstico de SOLO LECTURA del VPS. No instala ni cambia nada, no imprime variables de
# entorno ni secretos. Pega la salida completa en el chat.
#   bash diagnose-vps.sh
set -u

sec() { printf '\n===== %s =====\n' "$1"; }

sec "Sistema"
. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"
uname -srm
echo "CPU: $(nproc) núcleos"
free -h | sed -n '1,3p'
echo
df -h / /var/lib/docker 2>/dev/null | awk 'NR==1 || !seen[$1]++'

sec "Docker"
docker --version 2>&1
docker compose version 2>&1 | head -1
docker info --format 'Swarm: {{.Swarm.LocalNodeState}}  |  Storage: {{.Driver}}  |  Cgroup: {{.CgroupVersion}}' 2>&1

sec "Contenedores en marcha (solo nombre, imagen y estado)"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' 2>&1 | head -60

sec "Servicios de Swarm (si hay)"
docker service ls --format 'table {{.Name}}\t{{.Image}}\t{{.Replicas}}' 2>&1 | head -40

sec "Redes y volúmenes de Docker"
docker network ls --format '{{.Name}} ({{.Driver}}, {{.Scope}})' 2>&1 | head -30
echo
docker volume ls --format '{{.Name}}' 2>&1 | head -40

sec "Consumo actual de los contenedores"
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>&1 | head -40

sec "Puertos a la escucha"
(ss -tlnH 2>/dev/null || netstat -tln 2>/dev/null) | awk '{print $4}' | sort -u | head -40

sec "Cortafuegos"
(command -v ufw >/dev/null && ufw status 2>&1 | head -15) || echo "ufw no instalado"

sec "Existe ya algo de MethaCity?"
docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Ei 'methacity|hermes|supabase|methadesk' || echo "nada"
docker volume ls --format '{{.Name}}' 2>/dev/null | grep -Ei 'methacity|hermes' || true

sec "Fin"
echo "Diagnóstico terminado: $(date -u +%FT%TZ)"
