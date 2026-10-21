# Changelog

## 0.1.0

- Mountable engine that introspects every ActiveRecord model: columns, keys, enums, validations, virtual attributes, associations (including through, polymorphic, HABTM), and single-table inheritance.
- React Flow map with group zones, focus mode, technical and plain-language views, and a 3D view.
- Saved layout, groups, descriptions, and tours in `config/model_map.json`.
- Presentation mode with tours.
- Live updates when models change in development; per-file fallback when a model fails to load.
- Offline HTML export, `model_map:schema`, `model_map:export`, and `model_map:gaps` rake tasks.
