class Case < ApplicationRecord
  belongs_to :person
  belongs_to :assigned_officer, class_name: "User", optional: true
  has_many :vetting_checks, dependent: :destroy
  has_many :referrals, dependent: :destroy
  has_many :interviews, dependent: :destroy
  has_many :notes, as: :notable, dependent: :destroy
  has_many :documents, as: :attachable, dependent: :destroy
  has_and_belongs_to_many :tags

  enum status: { intake: 0, pending_review: 1, decided: 2, closed: 3 }

  validates :receipt_number, presence: true, uniqueness: true, format: { with: /\A[A-Z]{3}\d{10}\z/ }
  validate :decision_requires_officer

  private

  def decision_requires_officer
    errors.add(:assigned_officer, "is required to decide a case") if decided? && assigned_officer.nil?
  end
end
