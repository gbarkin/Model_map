class Document < ApplicationRecord
  belongs_to :attachable, polymorphic: true
  enum category: { identity: 0, evidence: 1, correspondence: 2 }
  validates :filename, presence: true
end
