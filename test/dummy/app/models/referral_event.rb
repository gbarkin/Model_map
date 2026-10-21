class ReferralEvent < ApplicationRecord
  belongs_to :referral
  belongs_to :actor, class_name: "User", optional: true
  validates :event, presence: true
end
