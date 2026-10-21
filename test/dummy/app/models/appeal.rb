class Appeal < ApplicationRecord
  belongs_to :case
  enum status: { filed: 0, under_review: 1, granted: 2, denied: 3 }
  validates :filed_on, presence: true
end
