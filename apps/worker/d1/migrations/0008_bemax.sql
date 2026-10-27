-- Additive identity and conversation runtime; execution remains in ICVS/MAX-CORE.
INSERT OR IGNORE INTO divisions(id,name,color) VALUES ('max-sports','MAX Sports','#ef8245');
CREATE TABLE icv_entities (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, source_id TEXT NOT NULL,
 label TEXT NOT NULL, state TEXT NOT NULL, owner TEXT, revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(kind,source_id)
);
CREATE TABLE icv_history (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL REFERENCES icv_entities(id),
 state TEXT NOT NULL, recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_icv_history_entity ON icv_history(entity_id,sequence);
CREATE TABLE bemax_conversations (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bemax_owner ON bemax_conversations(owner,created_at);
CREATE TABLE bemax_messages (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
 conversation_id TEXT NOT NULL REFERENCES bemax_conversations(id),
 role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL,
 evidence TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bemax_messages ON bemax_messages(conversation_id,sequence);
CREATE TABLE bemax_memory (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL,
 entity_id TEXT REFERENCES icv_entities(id), content TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bemax_memory_owner ON bemax_memory(owner,created_at);
CREATE TABLE bemax_actions (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL,
 entity_id TEXT REFERENCES icv_entities(id), rationale TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','overridden')),
 result TEXT, decision_note TEXT, decided_by TEXT, decided_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO icv_entities(id,kind,source_id,label,state) SELECT 'product:'||id,'product',id,name,json_object('name',name,'division_id',division_id,'stage',stage,'status',status,'revenue',revenue,'score',score) FROM products;
CREATE TRIGGER icv_products_insert AFTER INSERT ON products BEGIN
 INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('product:'||NEW.id,'product',NEW.id,NEW.name,json_object('name',NEW.name,'division_id',NEW.division_id,'stage',NEW.stage,'status',NEW.status,'revenue',NEW.revenue,'score',NEW.score)) ON CONFLICT(id) DO UPDATE SET label=excluded.label,state=excluded.state,revision=revision+1,updated_at=CURRENT_TIMESTAMP;
 INSERT INTO icv_history(entity_id,state) VALUES ('product:'||NEW.id,json_object('name',NEW.name,'division_id',NEW.division_id,'stage',NEW.stage,'status',NEW.status,'revenue',NEW.revenue,'score',NEW.score)); END;
CREATE TRIGGER icv_products_update AFTER UPDATE ON products BEGIN
 UPDATE icv_entities SET label=NEW.name,state=json_object('name',NEW.name,'division_id',NEW.division_id,'stage',NEW.stage,'status',NEW.status,'revenue',NEW.revenue,'score',NEW.score),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='product:'||NEW.id;
 INSERT INTO icv_history(entity_id,state) VALUES ('product:'||NEW.id,json_object('name',NEW.name,'division_id',NEW.division_id,'stage',NEW.stage,'status',NEW.status,'revenue',NEW.revenue,'score',NEW.score)); END;
CREATE TRIGGER icv_products_delete AFTER DELETE ON products BEGIN
 UPDATE icv_entities SET state=json_set(state,'$.deleted',json('true')),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='product:'||OLD.id;
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='product:'||OLD.id; END;
INSERT INTO icv_entities(id,kind,source_id,label,state) SELECT 'division:'||id,'division',id,name,json_object('name',name,'color',color) FROM divisions;
CREATE TRIGGER icv_divisions_insert AFTER INSERT ON divisions BEGIN
 INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('division:'||NEW.id,'division',NEW.id,NEW.name,json_object('name',NEW.name,'color',NEW.color)) ON CONFLICT(id) DO UPDATE SET label=excluded.label,state=excluded.state,revision=revision+1,updated_at=CURRENT_TIMESTAMP;
 INSERT INTO icv_history(entity_id,state) VALUES ('division:'||NEW.id,json_object('name',NEW.name,'color',NEW.color)); END;
CREATE TRIGGER icv_divisions_update AFTER UPDATE ON divisions BEGIN
 UPDATE icv_entities SET label=NEW.name,state=json_object('name',NEW.name,'color',NEW.color),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='division:'||NEW.id;
 INSERT INTO icv_history(entity_id,state) VALUES ('division:'||NEW.id,json_object('name',NEW.name,'color',NEW.color)); END;
CREATE TRIGGER icv_divisions_delete AFTER DELETE ON divisions BEGIN
 UPDATE icv_entities SET state=json_set(state,'$.deleted',json('true')),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='division:'||OLD.id;
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='division:'||OLD.id; END;
INSERT INTO icv_entities(id,kind,source_id,label,state) SELECT 'project:'||id,'project',id,id,json_object('product_id',product_id,'stage',stage,'status',status,'message',message) FROM factory_runs;
CREATE TRIGGER icv_factory_runs_insert AFTER INSERT ON factory_runs BEGIN
 INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('project:'||NEW.id,'project',NEW.id,NEW.id,json_object('product_id',NEW.product_id,'stage',NEW.stage,'status',NEW.status,'message',NEW.message)) ON CONFLICT(id) DO UPDATE SET label=excluded.label,state=excluded.state,revision=revision+1,updated_at=CURRENT_TIMESTAMP;
 INSERT INTO icv_history(entity_id,state) VALUES ('project:'||NEW.id,json_object('product_id',NEW.product_id,'stage',NEW.stage,'status',NEW.status,'message',NEW.message)); END;
CREATE TRIGGER icv_factory_runs_update AFTER UPDATE ON factory_runs BEGIN
 UPDATE icv_entities SET label=NEW.id,state=json_object('product_id',NEW.product_id,'stage',NEW.stage,'status',NEW.status,'message',NEW.message),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='project:'||NEW.id;
 INSERT INTO icv_history(entity_id,state) VALUES ('project:'||NEW.id,json_object('product_id',NEW.product_id,'stage',NEW.stage,'status',NEW.status,'message',NEW.message)); END;
CREATE TRIGGER icv_factory_runs_delete AFTER DELETE ON factory_runs BEGIN
 UPDATE icv_entities SET state=json_set(state,'$.deleted',json('true')),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='project:'||OLD.id;
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='project:'||OLD.id; END;
INSERT INTO icv_entities(id,kind,source_id,label,state) SELECT 'approval:'||id,'approval',id,action,json_object('product_id',product_id,'action',action,'status',status,'decision_note',decision_note) FROM approvals;
CREATE TRIGGER icv_approvals_insert AFTER INSERT ON approvals BEGIN
 INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('approval:'||NEW.id,'approval',NEW.id,NEW.action,json_object('product_id',NEW.product_id,'action',NEW.action,'status',NEW.status,'decision_note',NEW.decision_note)) ON CONFLICT(id) DO UPDATE SET label=excluded.label,state=excluded.state,revision=revision+1,updated_at=CURRENT_TIMESTAMP;
 INSERT INTO icv_history(entity_id,state) VALUES ('approval:'||NEW.id,json_object('product_id',NEW.product_id,'action',NEW.action,'status',NEW.status,'decision_note',NEW.decision_note)); END;
CREATE TRIGGER icv_approvals_update AFTER UPDATE ON approvals BEGIN
 UPDATE icv_entities SET label=NEW.action,state=json_object('product_id',NEW.product_id,'action',NEW.action,'status',NEW.status,'decision_note',NEW.decision_note),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='approval:'||NEW.id;
 INSERT INTO icv_history(entity_id,state) VALUES ('approval:'||NEW.id,json_object('product_id',NEW.product_id,'action',NEW.action,'status',NEW.status,'decision_note',NEW.decision_note)); END;
CREATE TRIGGER icv_approvals_delete AFTER DELETE ON approvals BEGIN
 UPDATE icv_entities SET state=json_set(state,'$.deleted',json('true')),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='approval:'||OLD.id;
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='approval:'||OLD.id; END;
INSERT INTO icv_entities(id,kind,source_id,label,state) SELECT 'relationship:'||id,'relationship',id,relation,json_object('source_id',source_id,'target_id',target_id,'relation',relation,'retired_at',retired_at) FROM twin_relationships;
CREATE TRIGGER icv_twin_relationships_insert AFTER INSERT ON twin_relationships BEGIN
 INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('relationship:'||NEW.id,'relationship',NEW.id,NEW.relation,json_object('source_id',NEW.source_id,'target_id',NEW.target_id,'relation',NEW.relation,'retired_at',NEW.retired_at)) ON CONFLICT(id) DO UPDATE SET label=excluded.label,state=excluded.state,revision=revision+1,updated_at=CURRENT_TIMESTAMP;
 INSERT INTO icv_history(entity_id,state) VALUES ('relationship:'||NEW.id,json_object('source_id',NEW.source_id,'target_id',NEW.target_id,'relation',NEW.relation,'retired_at',NEW.retired_at)); END;
CREATE TRIGGER icv_twin_relationships_update AFTER UPDATE ON twin_relationships BEGIN
 UPDATE icv_entities SET label=NEW.relation,state=json_object('source_id',NEW.source_id,'target_id',NEW.target_id,'relation',NEW.relation,'retired_at',NEW.retired_at),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='relationship:'||NEW.id;
 INSERT INTO icv_history(entity_id,state) VALUES ('relationship:'||NEW.id,json_object('source_id',NEW.source_id,'target_id',NEW.target_id,'relation',NEW.relation,'retired_at',NEW.retired_at)); END;
CREATE TRIGGER icv_twin_relationships_delete AFTER DELETE ON twin_relationships BEGIN
 UPDATE icv_entities SET state=json_set(state,'$.deleted',json('true')),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='relationship:'||OLD.id;
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='relationship:'||OLD.id; END;
INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities;
INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('department:GOV','department','GOV','GOV','{}');
INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('department:STRAT','department','STRAT','STRAT','{}');
INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('department:ARCH','department','ARCH','ARCH','{}');
INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('department:BUILD','department','BUILD','BUILD','{}');
INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('department:TEST','department','TEST','TEST','{}');
INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('department:OPS','department','OPS','OPS','{}');
INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('department:DATA','department','DATA','DATA','{}');
INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('department:GROWTH','department','GROWTH','GROWTH','{}');

CREATE TRIGGER icv_memory_insert AFTER INSERT ON bemax_memory BEGIN
 INSERT OR IGNORE INTO icv_entities(id,kind,source_id,label,state,owner) VALUES ('memory:'||NEW.id,NEW.kind,NEW.id,NEW.kind,json_object('content',NEW.content,'entityId',NEW.entity_id),NEW.owner);
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='memory:'||NEW.id;
END;
CREATE TRIGGER icv_action_insert AFTER INSERT ON bemax_actions BEGIN
 INSERT INTO icv_entities(id,kind,source_id,label,state,owner) VALUES ('action:'||NEW.id,'recommendation',NEW.id,NEW.kind,json_object('status',NEW.status,'rationale',NEW.rationale,'entityId',NEW.entity_id),NEW.owner);
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='action:'||NEW.id;
END;
CREATE TRIGGER icv_action_update AFTER UPDATE ON bemax_actions BEGIN
 UPDATE icv_entities SET state=json_object('status',NEW.status,'rationale',NEW.rationale,'entityId',NEW.entity_id,'result',NEW.result,'decisionNote',NEW.decision_note),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='action:'||NEW.id;
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='action:'||NEW.id;
END;
