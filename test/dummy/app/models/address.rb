class Address < ApplicationRecord
  belongs_to :person
  enum kind: { residential: 0, mailing: 1, foreign: 2 }
  validates :line1, presence: true
end
