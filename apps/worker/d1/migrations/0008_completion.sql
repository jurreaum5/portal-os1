-- Additive domain records. Existing MAX-CORE, factory identities and history are untouched.
CREATE TABLE universe_identities (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL,
 invariants TEXT NOT NULL CHECK(json_valid(invariants)),
 state TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(state)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 source_version TEXT NOT NULL DEFAULT '', 
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER identity_invariants BEFORE UPDATE ON universe_identities
 WHEN NEW.id<>OLD.id OR NEW.kind<>OLD.kind OR NEW.invariants<>OLD.invariants
 BEGIN SELECT RAISE(ABORT,'Identity invariants are immutable'); END;
CREATE TRIGGER identity_retention BEFORE DELETE ON universe_identities
 BEGIN SELECT RAISE(ABORT,'Identity history must be retained'); END;
CREATE TABLE universe_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
 entity_id TEXT NOT NULL REFERENCES universe_identities(id), type TEXT NOT NULL,
 actor TEXT NOT NULL, source TEXT NOT NULL, evidence TEXT NOT NULL CHECK(json_valid(evidence)),
 observed_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_universe_events_entity ON universe_events(entity_id,sequence);
CREATE TRIGGER event_immutable_update BEFORE UPDATE ON universe_events
 BEGIN SELECT RAISE(ABORT,'Events are append only'); END;
CREATE TRIGGER event_immutable_delete BEFORE DELETE ON universe_events
 BEGIN SELECT RAISE(ABORT,'Events are append only'); END;
CREATE TABLE identity_relationships (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES universe_identities(id),
 target_id TEXT NOT NULL REFERENCES universe_identities(id), relation TEXT NOT NULL,
 evidence TEXT NOT NULL CHECK(json_valid(evidence)),
 CHECK(source_id<>target_id), UNIQUE(source_id,target_id,relation)
);
CREATE TABLE bemax_memory (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, entity_id TEXT NOT NULL REFERENCES universe_identities(id),
 kind TEXT NOT NULL, content TEXT NOT NULL, source TEXT NOT NULL,
 supersedes TEXT REFERENCES bemax_memory(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bemax_owner ON bemax_memory(owner_id,created_at);
CREATE TRIGGER memory_immutable_update BEFORE UPDATE ON bemax_memory
 BEGIN SELECT RAISE(ABORT,'Memory is append only'); END;
CREATE TRIGGER memory_immutable_delete BEFORE DELETE ON bemax_memory
 BEGIN SELECT RAISE(ABORT,'Memory is append only'); END;
CREATE TABLE autonomy_proposals (
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES universe_identities(id),
 action TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 evidence TEXT NOT NULL CHECK(json_valid(evidence)), expected_revision INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','overridden','applied','conflict')),
 actor TEXT NOT NULL, decision_reason TEXT, decided_by TEXT,
 compensation_for TEXT REFERENCES autonomy_effects(proposal_id), rule_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE autonomy_effects (
 proposal_id TEXT PRIMARY KEY REFERENCES autonomy_proposals(id),
 before_state TEXT NOT NULL, after_state TEXT NOT NULL, applied_revision INTEGER NOT NULL,
 compensation_id TEXT UNIQUE REFERENCES autonomy_proposals(id)
);
CREATE TABLE model_attempts (
 id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, day TEXT NOT NULL,
 reserved_microusd INTEGER NOT NULL, actual_microusd INTEGER,
 status TEXT NOT NULL CHECK(status IN ('reserved','succeeded','failed')),
 latency_ms INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_model_budget ON model_attempts(day);
CREATE TABLE simulation_runs (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, input TEXT NOT NULL, output TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Stable identities mirror existing graph identifiers. The domain registry is extensible.
INSERT INTO universe_identities(id,kind,label,invariants)
 SELECT 'product:'||id,'product',name,json_object('origin','products','key',id) FROM products;
INSERT INTO universe_identities(id,kind,label,invariants)
 SELECT 'division:'||id,'division',name,json_object('origin','divisions','key',id) FROM divisions;
INSERT INTO universe_identities(id,kind,label,invariants) VALUES
 ('ecosystem:max','ecosystem','MAX Universe','{"origin":"portal-os1","key":"max"}');
INSERT INTO universe_identities(id,kind,label,invariants,state) VALUES
 ('research:substrate','research-division','Substrate Division','{"origin":"max-institute","key":"substrate"}','{"topics":["Unified Simulation Substrate","Emergence","Uncertainty","Identity Systems"]}'),
 ('research:protocol','research-division','Protocol Division','{"origin":"max-institute","key":"protocol"}','{"topics":["Governance Protocols","Communication Standards","Ecosystem Routing"]}'),
 ('research:identity-physics','research-division','Identity Physics Division','{"origin":"max-institute","key":"identity-physics"}','{"topics":["ICV","Trust","Alignment","Continuity"]}'),
 ('research:quantum-manifold','research-division','Quantum-Manifold Division','{"origin":"max-institute","key":"quantum-manifold"}','{"topics":["MAX Quantum","Multi-Manifold Systems","Quantum XR","Advanced Simulation"]}');
INSERT INTO identity_relationships(id,source_id,target_id,relation,evidence)
 SELECT 'institute:'||id,'division:max-institute',id,'researches','{"source":"MAX Universe constitution"}' FROM universe_identities WHERE kind='research-division';
INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
 SELECT 'origin:'||id,id,'identity.registered','migration','existing records',invariants,CURRENT_TIMESTAMP FROM universe_identities;
-- Each domain effect commits atomically with its audit event; approved effects are retryable.
CREATE TRIGGER apply_autonomy AFTER UPDATE OF status ON autonomy_proposals
 WHEN NEW.status='applied' AND OLD.status IN ('approved','overridden')
 BEGIN
 SELECT CASE WHEN (SELECT revision FROM universe_identities WHERE id=NEW.entity_id)<>NEW.expected_revision THEN RAISE(ABORT,'Stale proposal') END;
 INSERT INTO autonomy_effects(proposal_id,before_state,after_state,applied_revision)
 SELECT NEW.id,state,NEW.payload,revision+1 FROM universe_identities WHERE id=NEW.entity_id;
 UPDATE universe_identities SET state=NEW.payload,revision=revision+1 WHERE id=NEW.entity_id;
 INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
 VALUES ('effect:'||NEW.id,NEW.entity_id,'autonomy.'||NEW.action,NEW.decided_by,'ICVS governed execution',json_object('proposalId',NEW.id,'evidence',json(NEW.evidence)),CURRENT_TIMESTAMP);
 END;
CREATE TRIGGER proposal_decision_immutable BEFORE UPDATE ON autonomy_proposals
 WHEN OLD.status NOT IN ('pending','approved','overridden') OR
 NEW.id<>OLD.id OR NEW.entity_id<>OLD.entity_id OR NEW.action<>OLD.action OR NEW.payload<>OLD.payload OR NEW.evidence<>OLD.evidence OR NEW.expected_revision<>OLD.expected_revision OR NEW.actor<>OLD.actor OR NEW.created_at<>OLD.created_at OR NEW.compensation_for IS NOT OLD.compensation_for OR NEW.rule_id IS NOT OLD.rule_id OR
 (OLD.status IN ('approved','overridden') AND (NEW.decided_by IS NOT OLD.decided_by OR NEW.decision_reason IS NOT OLD.decision_reason)) OR
 (NEW.status IN ('approved','overridden','rejected') AND NEW.decided_by IS NULL) OR
 (NEW.status='overridden' AND length(trim(COALESCE(NEW.decision_reason,'')))<10) OR
 (OLD.status='pending' AND NEW.status NOT IN ('approved','rejected','overridden')) OR
 (OLD.status IN ('approved','overridden') AND NEW.status NOT IN ('applied','conflict'))
 BEGIN SELECT RAISE(ABORT,'Invalid or immutable decision'); END;
CREATE TABLE sports_observations (
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES universe_identities(id),
 provider TEXT NOT NULL, league TEXT NOT NULL, category TEXT NOT NULL,
 source TEXT NOT NULL, observed_at TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sports_entity ON sports_observations(entity_id,observed_at);
CREATE TRIGGER sports_immutable_update BEFORE UPDATE ON sports_observations
 BEGIN SELECT RAISE(ABORT,'Observations are append only'); END;
CREATE TRIGGER sports_immutable_delete BEFORE DELETE ON sports_observations
 BEGIN SELECT RAISE(ABORT,'Observations are append only'); END;
CREATE TRIGGER compensate_autonomy AFTER UPDATE OF status ON autonomy_proposals
 WHEN NEW.status='applied' AND NEW.action='rollback'
 BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM autonomy_effects WHERE proposal_id=NEW.compensation_for AND compensation_id IS NULL AND applied_revision=NEW.expected_revision AND before_state=NEW.payload) THEN RAISE(ABORT,'Compensation target changed') END;
 UPDATE autonomy_effects SET compensation_id=NEW.id WHERE proposal_id=NEW.compensation_for;
 END;
UPDATE universe_identities SET state=json_set(state,'$.xrScenes',json('["quantum-xr-command-room"]')) WHERE id='division:quantum-xr';
CREATE UNIQUE INDEX idx_memory_successor ON bemax_memory(supersedes) WHERE supersedes IS NOT NULL;
CREATE TRIGGER audit_operational_decision AFTER UPDATE OF status ON autonomy_proposals
 WHEN OLD.status='pending' AND NEW.status IN ('approved','rejected','overridden')
 BEGIN
 INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
 VALUES ('decision:'||NEW.id,NEW.entity_id,'decision.'||NEW.status,NEW.decided_by,'Governor',json_object('proposalId',NEW.id,'reason',NEW.decision_reason),CURRENT_TIMESTAMP);
 END;
CREATE UNIQUE INDEX idx_autonomy_rule_revision ON autonomy_proposals(rule_id,entity_id,expected_revision) WHERE rule_id IS NOT NULL;
CREATE TABLE integration_health (
 id TEXT PRIMARY KEY, status TEXT NOT NULL, message TEXT NOT NULL,
 observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER identity_label_history AFTER UPDATE OF label ON universe_identities
 WHEN NEW.label<>OLD.label
 BEGIN
 INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
 VALUES ('label:'||NEW.id||':'||NEW.revision,NEW.id,'identity.label-changed','ICVS','native registry',json_object('before',OLD.label,'after',NEW.label),CURRENT_TIMESTAMP);
 END;
UPDATE universe_identities SET source_version=(SELECT updated_at||':'||stage||':'||status FROM products WHERE universe_identities.id='product:'||products.id) WHERE kind='product';
CREATE TRIGGER audit_operational_proposal AFTER INSERT ON autonomy_proposals
 BEGIN
 INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
 VALUES ('proposal:'||NEW.id,NEW.entity_id,'autonomy.proposed',NEW.actor,'ICVS',json_object('proposalId',NEW.id,'action',NEW.action,'evidence',json(NEW.evidence)),CURRENT_TIMESTAMP);
 END;
-- Represent the existing shared factory resource pool; no new executor or scheduler.
INSERT INTO universe_identities(id,kind,label,invariants)
 VALUES ('resource:execution','resource-pool','ICVS shared execution capacity','{"origin":"factory","key":"icvs:resource-allocation"}');
INSERT INTO identity_relationships(id,source_id,target_id,relation,evidence)
 VALUES ('resource:execution','ecosystem:max','resource:execution','allocates','{"source":"existing factory shared lease pool"}');
INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
 VALUES ('origin:resource:execution','resource:execution','identity.registered','migration','existing factory','{"source":"existing shared execution pool"}',CURRENT_TIMESTAMP);
