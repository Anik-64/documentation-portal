CREATE TABLE docsection (
    secno SERIAL PRIMARY KEY,
    parent_secno INT DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    content_path VARCHAR(512) DEFAULT NULL,
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INT DEFAULT 0,
    display_order INT DEFAULT 999,
    slug TEXT UNIQUE NOT NULL,
    CONSTRAINT fk_docsection_parentid FOREIGN KEY (parent_secno) REFERENCES docsection(secno) ON UPDATE CASCADE
);