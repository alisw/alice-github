if [[ -f ~/private/alice-github.sh ]]; then
  source ~/private/alice-github.sh
fi
export GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-unknown}"
export GITHUB_SECRET="${GITHUB_SECRET:-unknown}"
GITHUB_API="htts://github.com/api/v3"

node index.js
