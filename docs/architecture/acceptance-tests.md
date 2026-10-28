# Deployment Readiness

## Purpose

This document defines the production launch requirements for Portal-OS1 and the MAX Institute operating stack.

## Required secrets

The following secrets are required in production environments:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`

Additional operational secrets and tokens may be required by environment and deployment design, but the above are mandatory baseline requirements.

## Monitoring

Production monitoring must cover:

- provider health and state transitions
- simulation registration and execution health
- governance action outcomes
- API and worker availability
- audit and lineage pipeline health
- secrets rotation and expiry visibility

## Alerting

Alerting must be active for:

- provider failure or degraded state
- blocked or misconfigured adapters
- simulation replay or provenance errors
- governance approval failures
- recovery and rollback execution events
- backup or audit export issues

## Recovery

Recovery requirements include:

- known rollback pathway for provider failure
- controlled fallback to alternative providers
- policy-based revalidation before recovery completion
- documented emergency response and escalation route

## Backups

Production deployments must maintain:

- regular backups of system data and configuration
- verified restore procedures
- retention policies aligned with operational and audit needs
- validation of restore integrity

## Audit exports

Audit exports must be generated and accessible for:

- governance decisions
- provider states and failures
- simulation registrations and replays
- recovery and rollback actions
- approval and policy enforcement events

## Production status checklist

The production environment is considered ready only when all of the following are true:

- [ ] Provider Adapters Active
- [ ] Simulation Models Registered
- [ ] Policies Adopted
- [ ] Monitoring Active
- [ ] Alerting Active
- [ ] Backups Verified
- [ ] Audit Exports Verified

## Deployment gate

A production release must not proceed if any required secret is missing, provider health is not known, monitoring is inactive, or governance and audit requirements are incomplete.
