-- Add provenance without rewriting existing histories or changing runtime ownership.
ALTER TABLE model_attempts ADD COLUMN config_fingerprint TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_model_configuration ON model_attempts(provider_id,config_fingerprint,created_at);
CREATE TABLE simulation_provenance (
 model_id TEXT PRIMARY KEY REFERENCES simulation_registry(id),
 owner_id TEXT NOT NULL, domain TEXT NOT NULL,
 predecessor_id TEXT UNIQUE REFERENCES simulation_registry(id),
 evidence TEXT NOT NULL CHECK(json_valid(evidence)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO simulation_provenance(model_id,owner_id,domain,evidence)
 SELECT id,actor,'unspecified',json_object('sources',json_array(source),'legacy',json('true')) FROM simulation_registry;
CREATE TRIGGER simulation_provenance_update BEFORE UPDATE ON simulation_provenance BEGIN SELECT RAISE(ABORT,'Simulation provenance is immutable'); END;
CREATE TRIGGER simulation_provenance_delete BEFORE DELETE ON simulation_provenance BEGIN SELECT RAISE(ABORT,'Retain simulation provenance'); END;
CREATE TABLE simulation_replays (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES simulation_runs(id), actor TEXT NOT NULL,
 input_hash TEXT NOT NULL, expected_output_hash TEXT NOT NULL, actual_output_hash TEXT NOT NULL,
 matched INTEGER NOT NULL CHECK(matched IN (0,1)), engine_version TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER simulation_replay_update BEFORE UPDATE ON simulation_replays BEGIN SELECT RAISE(ABORT,'Replay evidence is immutable'); END;
CREATE TRIGGER simulation_replay_delete BEFORE DELETE ON simulation_replays BEGIN SELECT RAISE(ABORT,'Retain replay evidence'); END;

ALTER TABLE integration_health ADD COLUMN config_fingerprint TEXT NOT NULL DEFAULT '';
