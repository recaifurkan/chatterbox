#!/usr/bin/env bash
# Chatterbox — Durdur ve temizle
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${YELLOW}⏹  Chatterbox durduruluyor...${NC}"

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v docker-compose &>/dev/null; then
  DC="docker-compose"
else
  DC="docker compose"
fi

$DC down --remove-orphans

echo -e "${GREEN}✅ Tüm container'lar durduruldu.${NC}"
echo ""
echo -e "  Verileri silmek için (MongoDB, Redis, MinIO volume'ları):"
echo -e "  ${CYAN}$DC down -v${NC}"
