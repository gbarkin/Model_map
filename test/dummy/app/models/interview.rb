class Interview < ApplicationRecord
  belongs_to :case
  belongs_to :interviewer, class_name: "User"
  validates :scheduled_at, presence: true
end
