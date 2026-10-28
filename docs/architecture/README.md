# Portal-OS1 Architecture

## Purpose

This directory contains the authoritative architecture and operating documentation for the Portal-OS1 / MAX Institute system.

The architecture set is intended to provide:

- a single architectural reference for contributors
- a GitHub-native source of truth for governance and operations
- clear definitions for provider adapters, simulations, policies, deployment, and validation
- a baseline for implementation review and production readiness

## Layer model

The repository architecture is organized as follows:

- MAX Institute = Research Authority
- USS = Shared Reality Layer
- MANIFOLD = Universe Layer
- ICV = Identity Layer
- BEMAX = Strategic Intelligence Layer
- ICVS = Governance Layer
- Portal-OS1 = Operating System
- MAX Sports = Sports Intelligence Platform

## Architecture authority

The system is built around a layered stack in which each layer depends on explicit contracts and governance requirements.

This directory is authoritative for:

- provider interface definitions
- simulation catalog and controls
- policy registry and approval logic
- deployment readiness and operational safeguards
- acceptance criteria and production validation

## Document set

- `provider-adapters.md` — production provider specification and lifecycle states
- `simulation-models.md` — simulation catalog and validation requirements
- `institute-policies.md` — policy registry and governance controls
- `deployment-readiness.md` — deployment, secrets, monitoring, backup, and recovery requirements
- `acceptance-tests.md` — production validation and release gates

## Contribution expectations

Any implementation or operational work should remain aligned with the following principles:

- provider independence
- lineage and provenance
- deterministic replay
- approval-enforced governance
- measurable confidence
- observable recovery and auditability

The architecture in this folder supersedes informal assumptions in other parts of the repository when they conflict.
