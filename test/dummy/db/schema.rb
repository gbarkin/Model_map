ActiveRecord::Schema.define(version: 2026_10_20_000001) do
  create_table :users do |t|
    t.string :name, null: false
    t.string :email, null: false
    t.string :role, null: false, default: "officer"
    t.timestamps
  end

  create_table :people do |t|
    t.string :first_name
    t.string :last_name, null: false
    t.date :date_of_birth
    t.string :country_of_birth
    t.timestamps
  end

  create_table :addresses do |t|
    t.references :person, null: false
    t.integer :kind, null: false, default: 0
    t.string :line1, null: false
    t.string :city
    t.string :postal_code
    t.timestamps
  end

  create_table :relationships do |t|
    t.references :person, null: false
    t.references :relative, null: false
    t.integer :relation, null: false, default: 0
    t.timestamps
  end

  create_table :cases do |t|
    t.string :type, null: false
    t.references :person, null: false
    t.references :assigned_officer
    t.string :receipt_number, null: false
    t.integer :status, null: false, default: 0
    t.date :filed_on
    t.string :unhcr_reference
    t.integer :vetting_checks_count, null: false, default: 0
    t.integer :lock_version, null: false, default: 0
    t.timestamps
  end

  create_table :tags do |t|
    t.string :name, null: false
  end

  create_table :cases_tags, id: false do |t|
    t.references :case, null: false
    t.references :tag, null: false
  end

  create_table :interviews do |t|
    t.references :case, null: false
    t.references :interviewer, null: false
    t.datetime :scheduled_at, null: false
    t.string :location
    t.timestamps
  end

  create_table :appeals do |t|
    t.references :case, null: false
    t.date :filed_on
    t.integer :status, null: false, default: 0
    t.timestamps
  end

  create_table :vetting_checks do |t|
    t.string :type, null: false
    t.references :case, null: false
    t.integer :status, null: false, default: 0
    t.string :result_code
    t.datetime :completed_at
    t.timestamps
  end

  create_table :referrals do |t|
    t.references :case, null: false
    t.references :referred_by, null: false
    t.integer :status, null: false, default: 0
    t.integer :reason, null: false
    t.text :summary
    t.timestamps
  end

  create_table :referral_events do |t|
    t.references :referral, null: false
    t.references :actor
    t.string :event, null: false
    t.json :payload
    t.timestamps
  end

  create_table :notes do |t|
    t.references :notable, polymorphic: true, null: false
    t.references :author, null: false
    t.text :body, null: false
    t.timestamps
  end

  create_table :documents do |t|
    t.references :attachable, polymorphic: true, null: false
    t.integer :category, null: false, default: 0
    t.string :filename, null: false
    t.timestamps
  end

  create_table :legacy_records do |t|
    t.string :payload
  end
end
