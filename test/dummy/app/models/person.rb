class Person < ApplicationRecord
  has_many :cases, dependent: :restrict_with_error
  has_many :addresses, dependent: :destroy
  has_many :relationships, dependent: :destroy
  has_many :relatives, through: :relationships, source: :relative
  has_many :notes, as: :notable, dependent: :destroy
  has_many :documents, as: :attachable, dependent: :destroy

  attribute :preferred_language, :string, default: "en"

  validates :last_name, presence: true
  validates :first_name, length: { maximum: 100 }
end
