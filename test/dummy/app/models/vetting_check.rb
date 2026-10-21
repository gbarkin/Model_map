class VettingCheck < ApplicationRecord
  belongs_to :case, counter_cache: true
  enum status: { queued: 0, running: 1, cleared: 2, hit: 3, failed: 4 }
  validates :type, presence: true
end
