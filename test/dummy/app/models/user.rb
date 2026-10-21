class User < ApplicationRecord
  has_many :assigned_cases, class_name: "Case", foreign_key: :assigned_officer_id, inverse_of: :assigned_officer
  has_many :referrals_made, class_name: "Referral", foreign_key: :referred_by_id, inverse_of: :referred_by
  has_many :interviews, foreign_key: :interviewer_id, inverse_of: :interviewer

  validates :name, :email, presence: true
  validates :email, uniqueness: true, format: { with: /@/ }
end
