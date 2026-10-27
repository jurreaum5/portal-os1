-- Additive provenance. Prior scenarios are explicitly registered under the original engine.
CREATE TABLE simulation_registry (
 id TEXT PRIMARY KEY, version TEXT NOT NULL, model_class TEXT NOT NULL CHECK(model_class IN ('scenario','forecast','operational')),
 engine TEXT NOT NULL, source TEXT NOT NULL, assumptions TEXT NOT NULL,
 actor TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO simulation_registry VALUES ('max-core:scenario-v1','1','scenario','MAX-CORE Simulation','/api/substrate/scenarios','Supplied events, no prediction','migration',CURRENT_TIMESTAMP);
ALTER TABLE simulation_runs ADD COLUMN model_id TEXT NOT NULL DEFAULT 'max-core:scenario-v1' REFERENCES simulation_registry(id);
CREATE TRIGGER registry_update BEFORE UPDATE ON simulation_registry BEGIN SELECT RAISE(ABORT,'Register a new model version'); END;
CREATE TRIGGER registry_delete BEFORE DELETE ON simulation_registry BEGIN SELECT RAISE(ABORT,'Retain model lineage'); END;
CREATE TRIGGER simulation_update BEFORE UPDATE ON simulation_runs BEGIN SELECT RAISE(ABORT,'Runs are immutable'); END;
CREATE TRIGGER simulation_delete BEFORE DELETE ON simulation_runs BEGIN SELECT RAISE(ABORT,'Retain reproducibility evidence'); END;
CREATE TABLE research_versions (
 output_id TEXT PRIMARY KEY REFERENCES universe_identities(id),
 predecessor_id TEXT UNIQUE REFERENCES universe_identities(id),
 version INTEGER NOT NULL CHECK(version>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO research_versions(output_id,version) SELECT id,1 FROM universe_identities WHERE kind='research-output';
CREATE TRIGGER research_versions_update BEFORE UPDATE ON research_versions BEGIN SELECT RAISE(ABORT,'Research lineage is immutable'); END;
CREATE TRIGGER research_versions_delete BEFORE DELETE ON research_versions BEGIN SELECT RAISE(ABORT,'Retain research lineage'); END;
CREATE TABLE policy_checks (
 proposal_id TEXT PRIMARY KEY REFERENCES autonomy_proposals(id),
 policy_version TEXT NOT NULL, result TEXT NOT NULL CHECK(result IN ('passed','blocked')),
 reason TEXT NOT NULL, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER policy_checks_update BEFORE UPDATE ON policy_checks BEGIN SELECT RAISE(ABORT,'Policy checks are immutable'); END;
CREATE TRIGGER policy_checks_delete BEFORE DELETE ON policy_checks BEGIN SELECT RAISE(ABORT,'Retain policy checks'); END;
CREATE TRIGGER require_policy_check BEFORE UPDATE OF status ON autonomy_proposals
 WHEN NEW.status='applied' AND NOT EXISTS(SELECT 1 FROM policy_checks WHERE proposal_id=NEW.id AND result='passed')
 BEGIN SELECT RAISE(ABORT,'Execution policy check required'); END;
-- Model audit contains metadata only, never prompts, keys or generated text.
CREATE TRIGGER audit_model_reserved AFTER INSERT ON model_attempts BEGIN
 INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
 VALUES ('model-reserved:'||NEW.id,'ecosystem:max','model.reserved','BEMAX',NEW.provider_id,json_object('attemptId',NEW.id,'reservedMicrousd',NEW.reserved_microusd),CURRENT_TIMESTAMP);
END;
CREATE TRIGGER audit_model_completed AFTER UPDATE OF status ON model_attempts WHEN NEW.status<>OLD.status BEGIN
 INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
 VALUES ('model-result:'||NEW.id,'ecosystem:max','model.'||NEW.status,'BEMAX',NEW.provider_id,json_object('attemptId',NEW.id,'actualMicrousd',NEW.actual_microusd,'latencyMs',NEW.latency_ms),CURRENT_TIMESTAMP);
END;
INSERT INTO universe_identities(id,kind,label,invariants)
VALUES ('simulation-model:max-core:scenario-v1','simulation-model','MAX-CORE scenario v1','{"origin":"substrate","key":"max-core:scenario-v1","version":"1","modelClass":"scenario"}');
INSERT INTO identity_relationships(id,source_id,target_id,relation,evidence)
VALUES ('registry:max-core:scenario-v1','ecosystem:max','simulation-model:max-core:scenario-v1','registers','{"source":"/api/substrate/scenarios"}');
INSERT INTO identity_relationships(id,source_id,target_id,relation,evidence)
SELECT 'model-run:'||id,'simulation:'||id,'simulation-model:max-core:scenario-v1','uses-model','{"source":"migration 0009"}' FROM simulation_runs;
