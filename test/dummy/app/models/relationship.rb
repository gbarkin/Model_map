class Relationship < ApplicationRecord
  belongs_to :person
  belongs_to :relative, class_name: "Person"
  enum relation: { spouse: 0, child: 1, guardian: 2, sibling: 3 }
end
