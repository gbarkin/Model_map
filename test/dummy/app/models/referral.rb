class Referral < ApplicationRecord
  belongs_to :case
  belongs_to :referred_by, class_name: "User"
  has_many :referral_events, -> { order(:created_at) }, dependent: :destroy, inverse_of: :referral

  enum status: { draft: 0, submitted: 1, accepted: 2, returned: 3 }
  enum reason: { fraud_concern: 0, national_security: 1, medical: 2, other: 3 }, _prefix: true

  validates :reason, presence: true
end
