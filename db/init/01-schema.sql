-- Esquema. Se ejecuta SOLO la primera vez que se crea el volumen de PostgreSQL.

-- ---------- Estructura organizacional ----------
CREATE TABLE IF NOT EXISTS areas (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT         NOT NULL DEFAULT '',
  parent_id   INTEGER      REFERENCES areas(id) ON DELETE SET NULL,   -- "Depende de"
  leader_id   INTEGER,                                                -- "Responsable" (FK más abajo)
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (            -- cargos
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  area_id        INTEGER      NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  description    TEXT         NOT NULL DEFAULT '',
  reports_to_id  INTEGER      REFERENCES positions(id) ON DELETE SET NULL,  -- "Reporta a"
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (area_id, name)
);

-- ---------- Personas ----------
-- level: preajuste de permisos. permissions: tasks | docs | posts | admin
CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  username             VARCHAR(40)  NOT NULL UNIQUE,
  document             VARCHAR(30)  NOT NULL UNIQUE,
  first_name           VARCHAR(60)  NOT NULL,
  second_name          VARCHAR(60),
  last_name            VARCHAR(60)  NOT NULL,
  second_last_name     VARCHAR(60),
  name                 VARCHAR(240) NOT NULL,                -- nombre para mostrar (calculado)
  email                VARCHAR(160),                          -- correo corporativo
  phone                VARCHAR(30),
  hire_date            DATE,
  birth_date           DATE,
  area_id              INTEGER REFERENCES areas(id) ON DELETE SET NULL,
  position_id          INTEGER REFERENCES positions(id) ON DELETE SET NULL,
  level                VARCHAR(15)  NOT NULL DEFAULT 'colaborador'
                       CHECK (level IN ('colaborador','lider','responsable','administrador')),
  permissions          TEXT[]       NOT NULL DEFAULT ARRAY['tasks','docs'],
  photo_file_id        UUID,
  emergency_name       VARCHAR(120),
  emergency_phone      VARCHAR(30),
  personal_email       VARCHAR(160),
  personal_phone       VARCHAR(30),
  password_hash        TEXT         NOT NULL,
  must_change_password BOOLEAN      NOT NULL DEFAULT TRUE,
  active               BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_area ON users(area_id);
CREATE INDEX IF NOT EXISTS idx_users_position ON users(position_id);

DO $$ BEGIN
  ALTER TABLE areas ADD CONSTRAINT areas_leader_fk FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Repositorio ----------
-- context: repo (documentos de carpetas) | avatar | post (portadas) | task (adjuntos de tareas)
-- folder_kind/folder_id: carpeta del repositorio (área o cargo). NULL = raíz de la empresa.
CREATE TABLE IF NOT EXISTS files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  uploader_name TEXT        NOT NULL DEFAULT '',
  original_name TEXT        NOT NULL,
  stored_name   TEXT        NOT NULL,
  mime_type     TEXT        NOT NULL,
  size          BIGINT      NOT NULL,
  category      VARCHAR(10) NOT NULL DEFAULT 'other' CHECK (category IN ('image','document','other')),
  context       VARCHAR(10) NOT NULL DEFAULT 'repo' CHECK (context IN ('repo','avatar','post','task')),
  folder_kind   VARCHAR(10) CHECK (folder_kind IN ('area','position')),
  folder_id     INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(context, folder_kind, folder_id);

-- ---------- Tareas ----------
CREATE TABLE IF NOT EXISTS tasks (
  id                 SERIAL PRIMARY KEY,
  title              VARCHAR(200) NOT NULL,
  description        TEXT         NOT NULL DEFAULT '',
  creator_id         INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  creator_name       VARCHAR(240) NOT NULL DEFAULT '',
  assignee_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               VARCHAR(15)  NOT NULL DEFAULT 'asignada'
                     CHECK (kind IN ('asignada','autoasignada','solicitud','delegada')),
  due_date           DATE,
  file_id            UUID         REFERENCES files(id) ON DELETE SET NULL,
  status             VARCHAR(10)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  completion_note    TEXT,
  completion_file_id UUID         REFERENCES files(id) ON DELETE SET NULL,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id);

-- ---------- Chat ----------
-- sender_key / recipient_key: id del usuario como texto. recipient_key NULL = canal general
CREATE TABLE IF NOT EXISTS chat_messages (
  id            BIGSERIAL PRIMARY KEY,
  sender_key    VARCHAR(20)  NOT NULL,
  sender_name   VARCHAR(240) NOT NULL,
  recipient_key VARCHAR(20),
  content       TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_recipient ON chat_messages(recipient_key, id);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_key, id);

CREATE TABLE IF NOT EXISTS chat_reads (
  user_key VARCHAR(20) NOT NULL,
  peer_key VARCHAR(20) NOT NULL,
  last_id  BIGINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (user_key, peer_key)
);

-- ---------- Publicaciones ----------
CREATE TABLE IF NOT EXISTS posts (
  id               SERIAL PRIMARY KEY,
  title            VARCHAR(200) NOT NULL,
  body             TEXT         NOT NULL,
  cover_file_id    UUID         REFERENCES files(id) ON DELETE SET NULL,
  cover_alt        VARCHAR(240) NOT NULL DEFAULT '',
  audience_area_id INTEGER      REFERENCES areas(id) ON DELETE CASCADE,   -- NULL = toda la empresa
  author_id        INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  author_name      VARCHAR(240) NOT NULL,
  author_area      VARCHAR(120) NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id  INTEGER     NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_key VARCHAR(20) NOT NULL,
  PRIMARY KEY (post_id, user_key)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER      NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_key  VARCHAR(20)  NOT NULL,
  author_name VARCHAR(240) NOT NULL,
  author_area VARCHAR(120) NOT NULL DEFAULT '',
  body        TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, id);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id INTEGER     NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_key   VARCHAR(20) NOT NULL,
  PRIMARY KEY (comment_id, user_key)
);

-- ---------- Configuración de la empresa (una sola fila; los valores por defecto vienen del .env) ----------
CREATE TABLE IF NOT EXISTS company (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  name          VARCHAR(120),
  slogan        VARCHAR(200),
  primary_color VARCHAR(9),
  accent_color  VARCHAR(9),
  logo_file     TEXT,
  login_bg_file TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Cuenta de administrador (una sola fila) ----------
-- Si no hay fila, la contraseña válida es ADMIN_PASSWORD del .env. Cuando el administrador la cambia
-- desde la plataforma se guarda aquí (hash bcrypt) y tiene prioridad. Borrar la fila vuelve a la del .env.
CREATE TABLE IF NOT EXISTS admin_account (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
