#!/usr/bin/env bash
set -euo pipefail

[[ "$GITHUB_REPOSITORY" == DescartHsu/dsh-mobile ]] || { echo 'Unexpected repository'; exit 1; }
[[ "$GITHUB_REF" == refs/heads/my-custom ]] || { echo 'Run from my-custom only'; exit 1; }

git fetch --no-tags origin main my-custom
git fetch --no-tags https://github.com/saya-ch/dsh-mobile.git main
head=$(git rev-parse FETCH_HEAD)
base=$(git rev-parse origin/my-custom)
old_main=$(git rev-parse origin/main)

# Reject divergent history, including an upstream force push. Never force-push.
if ! git merge-base --is-ancestor "$old_main" "$head"; then
  echo '::error::origin/main has diverged from upstream/main. Manual review required.'
  exit 1
fi
if [[ "$old_main" != "$head" ]]; then
  git push origin "$head:refs/heads/main"
fi

printf 'head=%s\nbase=%s\n' "$head" "$base" >> "$GITHUB_OUTPUT"
printf 'Upstream: `%s`\n\nCustom: `%s`\n' "$head" "$base" >> "$GITHUB_STEP_SUMMARY"

pending=$(git rev-list --count "$base..$head")
if [[ "$pending" == 0 ]]; then
  echo 'No upstream changes to integrate.' >> "$GITHUB_STEP_SUMMARY"
  if [[ "${RUN_CHECKS:-false}" != true ]]; then
    echo 'check=false' >> "$GITHUB_OUTPUT"
    exit 0
  fi
else
  pr=$(gh pr list --repo "$GITHUB_REPOSITORY" --base my-custom --head main --state open --json number --jq '.[0].number // empty')
  if [[ -z "$pr" ]]; then
    body="$RUNNER_TEMP/upstream-sync-pr.md"
    cat > "$body" <<EOF
This PR integrates saya-ch/dsh-mobile main into the long-lived custom branch.

- main is updated only by fast-forward and retains original upstream commits.
- Review conflicts and preserve custom functionality before merging.
- Automated merge, plugin publication and signed APK publication are disabled in this workflow.
- Integration checks run in [Daily upstream sync]($GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID) and publish the upstream-sync/integration commit status.
- The existing full CI may require **Approve workflows to run** because this PR is created by GITHUB_TOKEN. Approve it before merging when needed.
- Merge with a merge commit to preserve upstream ancestry; do not squash or rebase this sync PR.
EOF
    gh pr create --repo "$GITHUB_REPOSITORY" --base my-custom --head main \
      --title 'chore: sync upstream into my-custom' --body-file "$body"
    pr=$(gh pr list --repo "$GITHUB_REPOSITORY" --base my-custom --head main --state open --json number --jq '.[0].number // empty')
    [[ -n "$pr" ]] || { echo 'Created PR could not be verified'; exit 1; }
  fi
  printf 'pr=%s\n' "$pr" >> "$GITHUB_OUTPUT"
  printf '\nReview PR: %s/%s/pull/%s\n' "$GITHUB_SERVER_URL" "$GITHUB_REPOSITORY" "$pr" >> "$GITHUB_STEP_SUMMARY"
fi

gh api --method POST "repos/$GITHUB_REPOSITORY/statuses/$head" \
  -f state=pending -f context='upstream-sync/integration' \
  -f description="Checking against custom ${base:0:12}" \
  -f target_url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" > /dev/null
echo 'check=true' >> "$GITHUB_OUTPUT"
