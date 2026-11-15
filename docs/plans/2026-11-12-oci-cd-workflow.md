# Implementation Plan: OCI Continuous Deployment Workflow on Master

**Date:** 2026-11-12  
**Task:** Create GitHub Actions workflow to auto-deploy changes merged into `master` on the OCI instance  
**Scope:** `.github/workflows/deploy.yml`, `docs/plans/2026-11-12-oci-cd-workflow.md`, repository GitHub Secrets  

## 1. Context & Objectives
As requested, changes merged through the `master` branch must automatically deploy to the OCI Ampere A1 (arm64) instance without manual SSH commands, while ensuring that feature/team branches (such as `Ahmed` or others) never trigger deployment on production.

## 2. Proposed Architecture & Workflow
Create `.github/workflows/deploy.yml`:
1. **Trigger Condition**:
   - Strictly triggered on `push` to `master`:
     ```yaml
     name: deploy
     on:
       push:
         branches:
           - master
     ```
2. **Quality Gate Before Deployment**:
   - Run linter and tests (API `pytest -q`, `ruff check .`, web `typecheck`) so broken builds on master fail before touching the server.
3. **Deployment Step via Secure SSH**:
   - Utilize standard, vetted action `appleboy/ssh-action@v1.2.0` (or native OpenSSH client in runner).
   - Authenticate via repository secrets:
     - `OCI_HOST`: `141.253.121.245`
     - `OCI_USER`: `ubuntu`
     - `OCI_SSH_KEY`: SSH private key
     - `OCI_PORT`: `22` (default)
4. **Server Execution Command**:
   ```bash
   cd /srv/journey-into-soil
   git fetch origin master
   git checkout master
   git pull origin master
   sudo docker compose up -d --build
   # Smoke test
   sleep 4
   curl -f http://127.0.0.1:8080/api/v1/health || exit 1
   ```

## 3. GitHub Secrets Configuration
We will set the required secrets in the GitHub repository `L4S3r/journey-into-soil` using `gh secret set`:
- `OCI_HOST` = `141.253.121.245`
- `OCI_USER` = `ubuntu`
- `OCI_SSH_KEY` = `~/.ssh/ssh-key-2026-09-17.key`

## 4. Verification & Definition of Done
1. `.github/workflows/deploy.yml` syntax validated.
2. Verified that the workflow only triggers on `branches: [master]`.
3. Secrets populated and verified via `gh secret list`.
4. Tests pass locally and commit pushed to branch `Ahmed`.
