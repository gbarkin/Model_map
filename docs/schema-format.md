# Schema format

The frontend only depends on this JSON, served at `GET <mount>/schema`. Any backend that produces it can reuse the React app unchanged, for example a Spring Boot starter reading the JPA metamodel.

```jsonc
{
  "app": "Case management",
  "rails_version": "8.0.2",          // informational
  "fingerprint": "6c1526090b5facd4", // changes whenever anything below changes
  "groups": { "Cases": "#B5832A" },  // group name -> color
  "load_errors": [                   // model files that raised while loading
    { "file": "app/models/x.rb", "constant": "X", "error": "NameError: ..." }
  ],
  "models": [
    {
      "name": "Case",
      "table_name": "cases",
      "namespace": null,
      "group": "Cases",
      "file": "app/models/case.rb",
      "primary_key": "id",
      "description": null,            // table comment, if the database has one
      "sti": { "parent": null, "base": "Case", "column": "type", "sti_name": null, "children": ["AsylumCase"] },
      "attributes": [
        {
          "name": "status", "type": "integer", "sql_type": "integer",
          "null": false, "default": 0, "primary_key": false,
          "foreign_key": "person",      // name of the belongs_to that owns this column
          "enum": ["intake", "decided"],
          "technical": false,           // hidden in plain-language view
          "virtual": false,             // declared with `attribute`, no column
          "validations": [{ "kind": "presence", "attributes": ["status"], "options": {} }]
        }
      ],
      "associations": [
        {
          "name": "vetting_checks", "macro": "has_many", "target": "VettingCheck",
          "foreign_key": "case_id", "dependent": "destroy", "inverse_of": "case",
          "through": null, "source": null, "as": null,
          "polymorphic": null, "targets": null,  // polymorphic belongs_to: possible parents
          "optional": null,                       // belongs_to only
          "join_table": null                      // has_and_belongs_to_many only
        }
      ],
      "enums": { "status": { "intake": 0, "decided": 2 } },
      "validations": [],
      "custom_validations": ["decision_requires_officer"]
    }
  ]
}
```

Keys with no value are omitted. STI children have an empty `attributes` list (they share the parent's table) and list only the associations, enums, and validations they add.

`macro` is one of `belongs_to`, `has_many`, `has_one`, `has_and_belongs_to_many`. A JPA adapter would map `@ManyToOne` to `belongs_to`, `@OneToMany` to `has_many`, `@OneToOne` to `has_one` or `belongs_to` depending on the owning side, `@ManyToMany` to `has_and_belongs_to_many`, and `@Inheritance(SINGLE_TABLE)` to `sti`.

## Layout file

`GET`/`PUT <mount>/store` reads and writes `config/model_map.json`:

```jsonc
{
  "version": 1,
  "positions": { "Case": { "x": 797, "y": 412 } },
  "models": { "Case": { "description": "One filing by one person", "group": "Cases", "hidden": true } },
  "groups": { "Cases": { "color": "#3A5A8C", "hidden": true } },
  "tours": [
    {
      "id": "k3j2", "name": "Intro",
      "steps": [
        { "id": "a1", "title": "Cases", "note": "What to say", "focus": "Case",
          "expanded": ["Case"], "plain": true, "center": { "x": 900, "y": 500, "zoom": 1 } }
      ]
    }
  ],
  "settings": {}
}
```

Values in `models` and `groups` override what the introspector reports.
