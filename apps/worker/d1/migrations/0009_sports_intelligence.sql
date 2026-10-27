-- Source-attributed Sports observations are immutable; corrections use a new id.
CREATE TABLE sports_observations (
 id TEXT PRIMARY KEY, subdivision TEXT NOT NULL, module TEXT NOT NULL,
 subject TEXT NOT NULL, summary TEXT NOT NULL, source TEXT NOT NULL,
 observed_at TEXT NOT NULL, product_id TEXT REFERENCES products(id),
 recorded_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sports_module ON sports_observations(module,observed_at);
CREATE TRIGGER icv_sports_insert AFTER INSERT ON sports_observations BEGIN
 INSERT INTO icv_entities(id,kind,source_id,label,state) VALUES ('sports-observation:'||NEW.id,'sports-observation',NEW.id,NEW.subject,json_object('subdivision',NEW.subdivision,'module',NEW.module,'summary',NEW.summary,'source',NEW.source,'observedAt',NEW.observed_at,'productId',NEW.product_id));
 INSERT INTO icv_history(entity_id,state) SELECT id,state FROM icv_entities WHERE id='sports-observation:'||NEW.id;
END;
