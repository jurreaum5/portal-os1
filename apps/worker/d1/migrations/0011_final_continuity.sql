-- Domain history projection over existing ICV identities, not another state engine.
CREATE TABLE identity_revisions (
 entity_id TEXT NOT NULL REFERENCES universe_identities(id), revision INTEGER NOT NULL,
 kind TEXT NOT NULL,label TEXT NOT NULL,invariants TEXT NOT NULL,state TEXT NOT NULL,
 source_version TEXT NOT NULL, capture TEXT NOT NULL,
 captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(entity_id,revision)
);
INSERT INTO identity_revisions(entity_id,revision,kind,label,invariants,state,source_version,capture)
 SELECT id,revision,kind,label,invariants,state,source_version,'migration-baseline' FROM universe_identities;
CREATE TRIGGER identity_revision_insert AFTER INSERT ON universe_identities BEGIN
 INSERT INTO identity_revisions(entity_id,revision,kind,label,invariants,state,source_version,capture)
 VALUES (NEW.id,NEW.revision,NEW.kind,NEW.label,NEW.invariants,NEW.state,NEW.source_version,'created');
END;
CREATE TRIGGER identity_revision_monotonic BEFORE UPDATE ON universe_identities
 WHEN (NEW.state<>OLD.state OR NEW.label<>OLD.label OR NEW.source_version<>OLD.source_version OR NEW.revision<>OLD.revision)
 AND NEW.revision<>OLD.revision+1
 BEGIN SELECT RAISE(ABORT,'Identity changes require the next revision'); END;
CREATE TRIGGER identity_revision_snapshot AFTER UPDATE ON universe_identities WHEN NEW.revision<>OLD.revision BEGIN
 INSERT INTO identity_revisions(entity_id,revision,kind,label,invariants,state,source_version,capture)
 VALUES (NEW.id,NEW.revision,NEW.kind,NEW.label,NEW.invariants,NEW.state,NEW.source_version,'revision');
END;
CREATE TRIGGER revision_update BEFORE UPDATE ON identity_revisions BEGIN SELECT RAISE(ABORT,'Identity revision history is immutable'); END;
CREATE TRIGGER revision_delete BEFORE DELETE ON identity_revisions BEGIN SELECT RAISE(ABORT,'Retain identity revision history'); END;
CREATE INDEX idx_research_predecessor ON research_versions(predecessor_id);
CREATE INDEX idx_identity_relationship_source ON identity_relationships(source_id,relation);
