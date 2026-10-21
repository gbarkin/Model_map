class Tag < ApplicationRecord
  has_and_belongs_to_many :cases
  validates :name, presence: true, uniqueness: true
end
