-- Additive shared-reality records; never replace product identities or MAX-CORE storage.
CREATE TABLE uss_identities (
 id TEXT PRIMARY KEY, registry TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE uss_revisions (
 identity_id TEXT NOT NULL REFERENCES uss_identities(id), version INTEGER NOT NULL CHECK(version > 0),
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), hash TEXT NOT NULL, previous_hash TEXT,
 created_at TEXT NOT NULL, PRIMARY KEY(identity_id,version)
);
CREATE TABLE uss_links (
 source_id TEXT NOT NULL, source_version INTEGER NOT NULL,
 target_id TEXT NOT NULL, target_version INTEGER NOT NULL, relation TEXT NOT NULL,
 PRIMARY KEY(source_id,source_version,target_id,target_version,relation),
 FOREIGN KEY(source_id,source_version) REFERENCES uss_revisions(identity_id,version),
 FOREIGN KEY(target_id,target_version) REFERENCES uss_revisions(identity_id,version)
);
CREATE INDEX uss_links_target ON uss_links(target_id,target_version);
CREATE TABLE uss_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
 identity_id TEXT NOT NULL REFERENCES uss_identities(id), version INTEGER NOT NULL,
 kind TEXT NOT NULL, actor TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), created_at TEXT NOT NULL,
 FOREIGN KEY(identity_id,version) REFERENCES uss_revisions(identity_id,version)
);
CREATE INDEX uss_events_identity ON uss_events(identity_id,sequence);
CREATE TABLE uss_decisions (
 identity_id TEXT NOT NULL, version INTEGER NOT NULL, action TEXT NOT NULL CHECK(action IN ('approve','reject','override')),
 actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(identity_id,version), FOREIGN KEY(identity_id,version) REFERENCES uss_revisions(identity_id,version)
);
CREATE TABLE uss_replays (
 id TEXT PRIMARY KEY, identity_id TEXT NOT NULL, version INTEGER NOT NULL, actor TEXT NOT NULL,
 input_hash TEXT NOT NULL, output_hash TEXT NOT NULL, reproducibility_hash TEXT NOT NULL,
 outputs TEXT NOT NULL CHECK(json_valid(outputs)), created_at TEXT NOT NULL,
 FOREIGN KEY(identity_id,version) REFERENCES uss_revisions(identity_id,version)
);
CREATE TABLE provider_observations (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, provider_id TEXT NOT NULL, kind TEXT NOT NULL,
 status TEXT NOT NULL, operation_id TEXT NOT NULL, metadata TEXT NOT NULL CHECK(json_valid(metadata)), created_at TEXT NOT NULL
);
CREATE INDEX provider_history ON provider_observations(provider_id,sequence);
CREATE TABLE uss_recoveries (
 id TEXT PRIMARY KEY, identity_id TEXT NOT NULL, version INTEGER NOT NULL, target_version INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('recommended','reviewed','approved','rejected','executing','validated','failed')),
 reason TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL,
 FOREIGN KEY(identity_id,version) REFERENCES uss_revisions(identity_id,version),
 FOREIGN KEY(identity_id,target_version) REFERENCES uss_revisions(identity_id,version)
);
CREATE TRIGGER uss_identities_no_update BEFORE UPDATE ON uss_identities BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_identities_no_delete BEFORE DELETE ON uss_identities BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_revisions_no_update BEFORE UPDATE ON uss_revisions BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_revisions_no_delete BEFORE DELETE ON uss_revisions BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_links_no_update BEFORE UPDATE ON uss_links BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_links_no_delete BEFORE DELETE ON uss_links BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_events_no_update BEFORE UPDATE ON uss_events BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_events_no_delete BEFORE DELETE ON uss_events BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_decisions_no_update BEFORE UPDATE ON uss_decisions BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_decisions_no_delete BEFORE DELETE ON uss_decisions BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_replays_no_update BEFORE UPDATE ON uss_replays BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER uss_replays_no_delete BEFORE DELETE ON uss_replays BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER provider_observations_no_update BEFORE UPDATE ON provider_observations BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TRIGGER provider_observations_no_delete BEFORE DELETE ON provider_observations BEGIN SELECT RAISE(ABORT, 'Immutable USS history'); END;
CREATE TABLE uss_operations (
 identity_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL,
 result TEXT CHECK(result IS NULL OR json_valid(result)), created_at TEXT NOT NULL,
 PRIMARY KEY(identity_id,version), FOREIGN KEY(identity_id,version) REFERENCES uss_revisions(identity_id,version)
);
