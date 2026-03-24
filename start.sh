#!/usr/bin/env bash
# =============================================================================
#  Chatterbox — Tek Komutla Başlat
#  Kullanım: ./start.sh
# =============================================================================
set -euo pipefail

# ── Renkler ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}ℹ  $*${NC}"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}▶  $*${NC}"; }

# ── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
cat <<'EOF'
   _____ _           _   _            _
  / ____| |         | | | |          | |
 | |    | |__   __ _| |_| |_ ___ _ __| |__   _____  __
 | |    | '_ \ / _` | __| __/ _ \ '__| '_ \ / _ \ \/ /
 | |____| | | | (_| | |_| ||  __/ |  | |_) | (_) >  <
  \_____|_| |_|\__,_|\__|\__\___|_|  |_.__/ \___/_/\_\
EOF
echo -e "${NC}"
echo -e "  ${BOLD}Gerçek Zamanlı Chat — 2x Backend | 2x Frontend | MinIO | Redis Adapter${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── 0. .env kontrolü ─────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  warn ".env dosyası bulunamadı."
  info  "Oluşturuluyor: cp .env.example .env"
  cp .env.example .env
  warn "Lütfen .env dosyasını düzenleyip güvenli şifreler girin, sonra tekrar çalıştırın."
  warn "En azından JWT_SECRET, JWT_REFRESH_SECRET, MONGO_ROOT_PASSWORD,"
  warn "REDIS_PASSWORD ve MINIO_SECRET_KEY değişkenlerini değiştirin."
  echo ""
  exit 1
fi
success ".env dosyası bulundu"

# ── 1. Docker socket otomatik tespiti (Colima + Docker Desktop) ──────────────
step "Docker bağlantısı kontrol ediliyor..."

for sock in \
  "$HOME/.colima/default/docker.sock" \
  "$HOME/.colima/docker.sock" \
  "/var/run/docker.sock" \
  "$HOME/Library/Containers/com.docker.docker/Data/docker.sock"; do
  if [ -S "$sock" ]; then
    export DOCKER_HOST="unix://$sock"
    break
  fi
done

command -v docker &>/dev/null || error "Docker kurulu değil → https://docs.docker.com/get-docker/"
docker info &>/dev/null 2>&1  || error "Docker daemon çalışmıyor.\n  Colima için: colima start\n  Docker Desktop için: uygulamayı aç"
success "Docker çalışıyor  (socket: ${DOCKER_HOST:-/var/run/docker.sock})"

# ── 2. docker-compose komutu belirleniyor ────────────────────────────────────
if command -v docker-compose &>/dev/null; then
  DC="docker-compose"
elif docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
else
  error "docker-compose bulunamadı → brew install docker-compose"
fi
info "Compose: $DC"

# ── 3. Buildx izin sorunu: kendi yazılabilir config dizinini kullan ──────────
DOCKER_CONF="$HOME/.docker-chat"
mkdir -p "$DOCKER_CONF"
[ -f "$HOME/.docker/config.json" ] && cp "$HOME/.docker/config.json" "$DOCKER_CONF/config.json" 2>/dev/null || true
export DOCKER_CONFIG="$DOCKER_CONF"
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
info "Build modu: klasik (buildx devre dışı)"

# ── 4. Port kontrolü ─────────────────────────────────────────────────────────
step "Portlar kontrol ediliyor..."
APP_PORT="${APP_PORT:-80}"
for port in "$APP_PORT" 9000 9001; do
  if lsof -Pi ":$port" -sTCP:LISTEN -t &>/dev/null 2>&1; then
    warn "Port $port kullanımda — çakışma olabilir"
  fi
done
success "Port kontrolü tamam"

# ── 5. Çalışan eski container'ları durdur ────────────────────────────────────
if $DC ps -q 2>/dev/null | grep -q .; then
  warn "Mevcut container'lar yeniden başlatılıyor..."
  $DC down --remove-orphans 2>/dev/null || true
fi

# ── 6. Build + Başlat ────────────────────────────────────────────────────────
step "Container'lar build ediliyor ve başlatılıyor..."
echo -e "  ${YELLOW}İlk çalıştırmada build 3-5 dk sürebilir...${NC}\n"

$DC up --build -d

# ── 7. Sağlık bekleme ────────────────────────────────────────────────────────
step "Servisler hazır bekleniyor..."

wait_for() {
  local svc=$1 label=$2 max=${3:-120} i=0
  printf "  %-22s " "$label"
  while [ $i -lt $max ]; do
    state=$($DC ps "$svc" 2>/dev/null | tail -1 | grep -oE 'healthy|running|Up|Exit|starting' | head -1 || echo "")
    case "$state" in
      healthy)      echo -e "${GREEN}✓ healthy${NC}";   return 0 ;;
      Up|running)   echo -e "${GREEN}✓ running${NC}";   return 0 ;;
      Exit*|exited) echo -e "${RED}✗ başarısız${NC}"; $DC logs "$svc" --tail=15; return 1 ;;
    esac
    printf "."; sleep 3; i=$((i+3))
  done
  echo -e "${YELLOW}⚠ timeout${NC}"
}

wait_for mongodb   "MongoDB"       90
wait_for redis     "Redis"         60
wait_for minio     "MinIO"         90
wait_for backend   "Backend-1"    120
wait_for backend2  "Backend-2"    120
wait_for frontend  "Frontend-1"    60
wait_for frontend2 "Frontend-2"    60
wait_for nginx     "Nginx"         30

# ── 8. Son test ───────────────────────────────────────────────────────────────
step "Uygulama test ediliyor..."
sleep 3
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:${APP_PORT}/" 2>/dev/null || echo "000")
HEALTH=$(curl -s --max-time 5 "http://localhost:${APP_PORT}/health" 2>/dev/null || echo "")

[ "$HTTP" = "200" ] && success "Uygulama erişilebilir (HTTP 200)" \
                    || warn "HTTP $HTTP — Nginx başlıyor olabilir, 10sn bekleyin"

if echo "$HEALTH" | grep -q "instance"; then
  INST=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('instance','?'))" 2>/dev/null || echo "?")
  info "Health yanıtı → instance: $INST"
fi

# ── 9. Özet ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  🎉 Chatterbox Hazır!${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}🌐 Uygulama      :${NC}  ${CYAN}http://localhost:${APP_PORT}${NC}"
echo -e "  ${BOLD}📦 MinIO Console :${NC}  ${CYAN}http://localhost:9001${NC}  (bkz: .env → MINIO_ACCESS_KEY / MINIO_SECRET_KEY)"
echo ""
echo -e "  ${BOLD}Servisler:${NC}"
$DC ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | awk '{printf "  %s\n", $0}'
echo ""
echo -e "  ${BOLD}Diğer komutlar:${NC}"
echo -e "    ${YELLOW}./stop.sh${NC}                       → Durdur"
echo -e "    ${YELLOW}$DC logs -f${NC}             → Tüm loglar"
echo -e "    ${YELLOW}$DC logs -f backend${NC}     → Backend-1 logu"
echo ""

[[ "$OSTYPE" == "darwin"* ]] && sleep 1 && open "http://localhost:${APP_PORT}" &>/dev/null &
true
