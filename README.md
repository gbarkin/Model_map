# model_map

A live, interactive map of your ActiveRecord models for walking stakeholders through a data model. Install the gem, mount the engine, and open `/model_map`. Every model is discovered at runtime; nothing goes in model files.

- Cards for each model with columns, keys, enums, and validations; click one to focus it and its neighbors
- Relationship lines with crow's-foot ends, covering `belongs_to`, `has_many`, `has_one`, `has_many :through`, polymorphic, HABTM, and single-table inheritance
- Technical and plain-language views (plain hides ids, timestamps, and keys, and uses your descriptions)
- Groups drawn as shaded zones; drag a zone to move the whole group
- Tours: saved sequences of views with on-screen notes, played full screen with the arrow keys
- 3D view you can rotate and fly through
- Live updates: add or change a model in development and the map updates within a few seconds
- Offline copy: one HTML file with the map, layout, and tours inlined, for presenting without a server

## Install

```ruby
# Gemfile: development and staging only
group :development, :staging do
  gem "model_map", path: "../model_map"   # or git: "https://github.com/<your-org>/model_map"
end
```

```sh
bundle install
bin/rails generate model_map:install   # writes config/initializers/model_map.rb and mounts the engine
```

The generator adds this route, which is safe when the gem is absent:

```ruby
mount ModelMap::Engine => "/model_map" if defined?(ModelMap::Engine)
```

Open `http://localhost:3000/model_map`. The first visit lays the models out automatically.

### Keeping it out of production

- Put the gem in a Gemfile group that production does not install, and set `BUNDLE_WITHOUT="development:staging"` on production servers.
- If staging runs with `RAILS_ENV=production`, Gemfile groups keyed to the environment will not separate the two. Use a real `staging` environment or control installation with `BUNDLE_WITHOUT` per server.
- The engine also returns 404 outside `enabled_environments` (default: development, staging, test), so a stray install stays dark.

## Configuration

`config/initializers/model_map.rb`:

```ruby
return unless defined?(ModelMap)

ModelMap.configure do |config|
  config.title = "Case management"

  # Group models by name: strings, "Prefix*" globs, regexes, or procs.
  config.group "Case intake", "Case", "Person", "Intake::*", color: "#3A5A8C"
  config.group "Vetting", /Check\z/

  # Access control (pick one or combine)
  config.parent_controller = "ApplicationController"             # reuse your before_actions
  config.authenticate = -> { head :forbidden unless current_user&.admin? }
  config.basic_auth = [ENV["MODEL_MAP_USER"], ENV["MODEL_MAP_PASSWORD"]] if ENV["MODEL_MAP_USER"]

  config.exclude = ["LegacyImport", /\AArchive::/]
  config.include = ["PaperTrail::Version"]   # framework models are hidden by default
  config.technical_columns += ["tenant_id"]  # hidden in plain-language view

  config.enabled_environments = %w[development staging]
  config.allow_writes = Rails.env.development?   # saving layouts from the browser
  config.poll_interval = 2500                    # ms; 0 turns off live updates
end
```

| Option | Default | Notes |
|---|---|---|
| `enabled` | from `enabled_environments` | Set true or false to override |
| `enabled_environments` | development, staging, test | |
| `allow_writes` | development and test | Elsewhere, edits stay in the browser until you download the layout |
| `store_path` | `config/model_map.json` | Commit this file |
| `parent_controller` | `ActionController::Base` | |
| `authenticate` | none | Block runs inside the controller with `instance_exec` |
| `basic_auth` | none | `[user, password]` |
| `group(name, *matchers, color:)` | namespace, then STI base | First matching rule wins |
| `exclude`, `include` | `[]` | Same matcher types as `group` |
| `include_framework_models` | false | ActiveStorage, ActionText, Solid Queue, PaperTrail, and similar |
| `technical_columns` | id, timestamps, `*_id`, `*_type`, type, lock_version | |
| `poll_interval` | 2500 | |
| `title` | app module name | |

## Using it

| Action | How |
|---|---|
| Focus a model | Click its card or its name in the list. Neighbors stay lit, the rest fades. |
| Show all fields | "Show N more" on a card, or open the detail panel |
| Find a model or field | Press `/` |
| Clear focus | `Esc` or click the canvas |
| Move a group | Drag its shaded zone |
| Rearrange | "Arrange" recomputes the layout for visible models |
| Hide a model or group | Eye icon in the list. Hidden state is saved with the layout. |
| Describe a model | Detail panel. Descriptions appear on cards in plain-language view. |
| Record a tour | Tours tab, create a tour, then arrange the view and "Add current view" for each step |
| Present | "Present tour" or "Present". Arrow keys or space to move, `Esc` to leave. |
| Offline copy | Downloads a single HTML file. Also `bin/rails model_map:export`. |

### The layout file

Positions, groups, descriptions, hidden models, and tours save to `config/model_map.json`. Commit it so the team shares one layout. On environments where `allow_writes` is false, changes are kept in that browser; use "Download layout" and commit the file. The format is in [docs/schema-format.md](docs/schema-format.md).

### Rake tasks

```sh
bin/rails model_map:schema OUT=tmp/schema.json   # introspected schema as JSON
bin/rails model_map:export OUT=tmp/map.html      # offline HTML copy
bin/rails model_map:gaps                         # models with no group or description
bin/rails model_map:gaps STRICT=1                # exits 1 if any, for CI
```

## How it works

- `ModelMap::Introspector` eager-loads the app, walks `ActiveRecord::Base.descendants`, and reads columns, `reflect_on_all_associations`, `defined_enums`, `validators`, `attribute_types`, and STI settings. It skips abstract classes, models without tables, HABTM join classes, and stale classes left over from a code reload.
- If one model file raises while loading, the rest still load and the map shows which file failed.
- Results are cached until the next code reload or migration, so the browser's fingerprint poll is cheap.
- The React app (React Flow, ELK layout, three.js for 3D) is prebuilt into `dist/` and served by the engine's own controller. The host's asset pipeline is not involved, and no npm packages are installed in the host app.
- Nothing is sent anywhere. Fonts are bundled; the page makes requests only to its own engine routes.

## Security notes

- The map exposes your full data model. Keep it behind authentication on any shared environment.
- Writes require a CSRF token and are validated against a fixed set of keys before anything touches disk.
- Assets are served only from `dist/app` by exact file name.

## Development

```sh
bundle install
bundle exec rake test        # Ruby tests against the sample app in test/dummy
bin/dummy-server             # sample app at http://localhost:3000/model_map
cd frontend && npm ci
npm run dev                  # Vite dev server using frontend/dev/schema.json
npm run fixture              # refresh that fixture from the sample app
npm test                     # graph logic tests
bin/build-frontend           # rebuild dist/ before committing frontend changes
```

The sample app in `test/dummy` has people, cases (asylum and refugee as STI), vetting checks (STI), referrals, polymorphic notes and documents, HABTM tags, and a five-step tour in `test/dummy/config/model_map.json`.

## Compatibility

- Tested on Rails 6.1 with Ruby 3.2 and SQLite.
- Rails 7.x and 8.x use the same reflection APIs and are expected to work, but are not yet covered by CI.
- PostgreSQL and MySQL table and column comments appear as descriptions when present.

## License

MIT
